import io
import json
import logging
import re
import shutil
import uuid
import zipfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlmodel import Session, select

from . import diarize, translate, worker
from .config import DEFAULT_MODE, FRONTEND_DIST, LANGUAGES, MAX_UPLOAD_MB, MODES
from .db import Job, engine, init_db
from .exports import FORMATS, ExportOptions, render
from .pipeline import load_json, save_json

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
app = FastAPI(title="Murmur")


@app.on_event("startup")
def _startup():
    init_db()
    worker.start()


# ---------- helpers ----------

def _get(s: Session, job_id: str) -> Job:
    job = s.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Transcript not found")
    return job


def _transcript_path(job: Job, lang: Optional[str] = None) -> Path:
    return job.folder / (f"transcript.{lang}.json" if lang else "transcript.json")


def _load_transcript(job: Job, lang: Optional[str] = None) -> dict:
    p = _transcript_path(job, lang)
    if not p.exists():
        raise HTTPException(404, "Transcript not ready" if not lang else "Translation not found")
    return load_json(p)


def _safe_name(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|]+', "_", name).strip() or "transcript"


def _new_job(**kw) -> Job:
    return Job(id=uuid.uuid4().hex[:12], **kw)


def _options(language, mode, diarize_, num_speakers, to_english, clean):
    if language and language not in LANGUAGES:
        raise HTTPException(400, f"Unknown language {language}")
    if mode not in MODES:
        raise HTTPException(400, f"Unknown mode {mode}")
    return dict(language=language or None, mode=mode, diarize=diarize_, num_speakers=num_speakers,
                translate_to_english=to_english, clean_audio=clean)


# ---------- config ----------

@app.get("/api/config")
def config():
    return {
        "languages": [{"code": c, "name": n} for c, n in sorted(LANGUAGES.items(), key=lambda kv: kv[1])],
        "modes": [{"id": k, **v} for k, v in MODES.items()],
        "default_mode": DEFAULT_MODE,
        "diarization_method": diarize.available_method(),
        "export_formats": list(FORMATS),
        "max_upload_mb": MAX_UPLOAD_MB,
    }


@app.get("/api/translate/languages")
def translation_languages():
    return translate.target_languages()


# ---------- jobs ----------

@app.post("/api/jobs")
def create_jobs(
    files: list[UploadFile] = File(...),
    language: str = Form(""),
    mode: str = Form(DEFAULT_MODE),
    diarize: bool = Form(False),
    num_speakers: int = Form(-1),
    translate_to_english: bool = Form(False),
    clean_audio: bool = Form(False),
):
    opts = _options(language, mode, diarize, num_speakers, translate_to_english, clean_audio)
    created = []
    with Session(engine) as s:
        for f in files:
            name = f.filename or "upload"
            job = _new_job(title=Path(name).stem, original_filename=name,
                           media_file="source" + Path(name).suffix.lower(), **opts)
            job.folder.mkdir(parents=True, exist_ok=True)
            dest = job.folder / job.media_file
            size = 0
            with dest.open("wb") as out:
                while chunk := f.file.read(1 << 20):
                    size += len(chunk)
                    if MAX_UPLOAD_MB and size > MAX_UPLOAD_MB * (1 << 20):
                        out.close()
                        shutil.rmtree(job.folder, ignore_errors=True)
                        raise HTTPException(413, f"{name} is larger than {MAX_UPLOAD_MB} MB")
                    out.write(chunk)
            s.add(job)
            created.append(job)
        s.commit()
        for j in created:
            s.refresh(j)
        result = [j.public() for j in created]
    worker.notify()
    return result


class UrlJob(BaseModel):
    url: str
    language: str = ""
    mode: str = DEFAULT_MODE
    diarize: bool = False
    num_speakers: int = -1
    translate_to_english: bool = False
    clean_audio: bool = False


@app.post("/api/jobs/url")
def create_url_job(body: UrlJob):
    if not re.match(r"^https?://", body.url):
        raise HTTPException(400, "Enter a full http(s) link")
    opts = _options(body.language, body.mode, body.diarize, body.num_speakers,
                    body.translate_to_english, body.clean_audio)
    with Session(engine) as s:
        job = _new_job(title=body.url, source_type="url", source_url=body.url, **opts)
        job.folder.mkdir(parents=True, exist_ok=True)
        s.add(job)
        s.commit()
        s.refresh(job)
        result = job.public()
    worker.notify()
    return result


@app.get("/api/jobs")
def list_jobs():
    with Session(engine) as s:
        return [j.public() for j in s.exec(select(Job).order_by(Job.created_at.desc()))]


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    with Session(engine) as s:
        return _get(s, job_id).public()


class JobPatch(BaseModel):
    title: Optional[str] = None
    speakers: Optional[dict[str, str]] = None


@app.patch("/api/jobs/{job_id}")
def patch_job(job_id: str, body: JobPatch):
    with Session(engine) as s:
        job = _get(s, job_id)
        if body.title is not None:
            job.title = body.title.strip() or job.title
        if body.speakers is not None:
            job.speakers_json = json.dumps({k: v.strip() for k, v in body.speakers.items() if v.strip()})
        s.add(job)
        s.commit()
        s.refresh(job)
        return job.public()


@app.post("/api/jobs/{job_id}/retry")
def retry_job(job_id: str):
    with Session(engine) as s:
        job = _get(s, job_id)
        if job.status != "failed":
            raise HTTPException(400, "Only failed jobs can be retried")
        job.status, job.stage, job.progress, job.error = "queued", "Waiting in queue", 0.0, None
        s.add(job)
        s.commit()
        s.refresh(job)
        result = job.public()
    worker.notify()
    return result


@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: str):
    with Session(engine) as s:
        job = _get(s, job_id)
        folder = job.folder
        s.delete(job)
        s.commit()
    shutil.rmtree(folder, ignore_errors=True)
    return {"ok": True}


# ---------- transcript ----------

@app.get("/api/jobs/{job_id}/transcript")
def get_transcript(job_id: str, lang: Optional[str] = None):
    with Session(engine) as s:
        job = _get(s, job_id)
    return _load_transcript(job, lang)


class SegmentEdit(BaseModel):
    id: int
    text: Optional[str] = None
    speaker: Optional[str] = None


class TranscriptEdit(BaseModel):
    segments: list[SegmentEdit]


@app.put("/api/jobs/{job_id}/transcript")
def edit_transcript(job_id: str, body: TranscriptEdit):
    with Session(engine) as s:
        job = _get(s, job_id)
    t = _load_transcript(job)
    by_id = {seg["id"]: seg for seg in t["segments"]}
    for e in body.segments:
        seg = by_id.get(e.id)
        if not seg:
            continue
        if e.text is not None and e.text.strip() != seg["text"]:
            seg["text"] = e.text.strip()
            seg["edited"] = True
        if e.speaker is not None:
            seg["speaker"] = e.speaker or None
    save_json(_transcript_path(job), t)
    return t


@app.get("/api/jobs/{job_id}/media")
def get_media(job_id: str):
    with Session(engine) as s:
        job = _get(s, job_id)
    if not job.media_file or not (job.folder / job.media_file).exists():
        raise HTTPException(404, "No media")
    return FileResponse(job.folder / job.media_file)


class TranslateBody(BaseModel):
    target: str


@app.post("/api/jobs/{job_id}/translate")
def translate_job(job_id: str, body: TranslateBody):
    with Session(engine) as s:
        job = _get(s, job_id)
    t = _load_transcript(job)
    try:
        out = translate.translate_transcript(t, body.target)
    except ValueError as e:
        raise HTTPException(400, str(e))
    save_json(_transcript_path(job, body.target), out)
    return out


# ---------- export ----------

def _render(job: Job, fmt: str, timestamps: bool, speakers: bool, lang: Optional[str]) -> tuple[bytes, str]:
    if fmt not in FORMATS:
        raise HTTPException(400, f"Unsupported format {fmt}")
    t = _load_transcript(job, lang)
    data = render(fmt, t, job.speakers, ExportOptions(timestamps=timestamps, speakers=speakers), job.title)
    suffix = f".{lang}" if lang else ""
    return data, f"{_safe_name(job.title)}{suffix}.{FORMATS[fmt][1]}"


@app.get("/api/jobs/{job_id}/export")
def export(job_id: str, format: str = "txt", timestamps: bool = True, speakers: bool = True,
           lang: Optional[str] = None):
    with Session(engine) as s:
        job = _get(s, job_id)
    data, filename = _render(job, format, timestamps, speakers, lang)
    return Response(data, media_type=FORMATS[format][0],
                    headers={"Content-Disposition": f"attachment; filename*=UTF-8''{_quote(filename)}"})


class BulkExport(BaseModel):
    ids: list[str]
    format: str = "txt"
    timestamps: bool = True
    speakers: bool = True


@app.post("/api/export/bulk")
def bulk_export(body: BulkExport):
    buf = io.BytesIO()
    used: set[str] = set()
    with Session(engine) as s, zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for job_id in body.ids:
            job = s.get(Job, job_id)
            if not job or job.status != "done":
                continue
            data, name = _render(job, body.format, body.timestamps, body.speakers, None)
            base, n = name, 2
            while name in used:
                name = f"{Path(base).stem} ({n}){Path(base).suffix}"
                n += 1
            used.add(name)
            z.writestr(name, data)
    if not used:
        raise HTTPException(400, "None of the selected transcripts are ready")
    return Response(buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="murmur-export-{body.format}.zip"'})


class BulkDelete(BaseModel):
    ids: list[str]


@app.post("/api/jobs/bulk-delete")
def bulk_delete(body: BulkDelete):
    for job_id in body.ids:
        try:
            delete_job(job_id)
        except HTTPException:
            pass
    return {"ok": True}


def _quote(s: str) -> str:
    from urllib.parse import quote
    return quote(s)


# ---------- static front end ----------

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = FRONTEND_DIST / path
        if path and f.is_file():
            return FileResponse(f)
        return FileResponse(FRONTEND_DIST / "index.html")

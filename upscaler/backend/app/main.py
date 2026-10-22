"""Clarion API + static UI server."""
from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import engine, jobs, video
from .models_registry import PRESETS

app = FastAPI(title="Clarion")
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

DEFAULTS = {
    "preset": "balanced", "scale": 4, "target": None, "denoise": 0.5, "sharpen": 0.0, "faces": False,
    "image_format": "png", "codec": "h264", "fps": "source", "slowmo": 1, "preview": False, "preview_seconds": 5,
}


@app.on_event("startup")
def _startup() -> None:
    jobs.start()


@app.get("/api/system")
def system():
    return engine.device_info()


@app.get("/api/options")
def options():
    return {
        "presets": [vars(p) for p in PRESETS.values()],
        "image_scales": [1, 2, 4, 8],
        "video_scales": [2, 4],
        "video_targets": ["720p", "1080p", "1440p", "4k"],
        "image_formats": list(jobs.IMAGE_OUT),
        "codecs": [{"id": k, "label": v[0]} for k, v in video.CODECS.items()],
        "fps": ["source", 24, 25, 30, 50, 60],
        "slowmo": [1, 2, 4],
        "defaults": DEFAULTS,
    }


def _clean(settings: dict) -> dict:
    s = {**DEFAULTS, **{k: v for k, v in settings.items() if k in DEFAULTS}}
    if s["preset"] not in PRESETS:
        raise HTTPException(400, "Unknown preset")
    if s["codec"] not in video.CODECS or s["image_format"] not in jobs.IMAGE_OUT:
        raise HTTPException(400, "Unknown output format")
    s["denoise"] = min(1.0, max(0.0, float(s["denoise"])))
    s["sharpen"] = min(1.0, max(0.0, float(s["sharpen"])))
    s["scale"] = float(s["scale"]) if s["scale"] else None
    if s["scale"] is not None and not 1 <= s["scale"] <= 8:
        raise HTTPException(400, "Scale must be between 1 and 8")
    if s["target"] not in (None, "", "720p", "1080p", "1440p", "4k"):
        raise HTTPException(400, "Unknown target")
    s["target"] = s["target"] or None
    s["slowmo"] = int(s["slowmo"]) if int(s["slowmo"]) in (1, 2, 4) else 1
    s["preview_seconds"] = min(30.0, max(1.0, float(s["preview_seconds"])))
    s["faces"], s["preview"] = bool(s["faces"]), bool(s["preview"])
    return s


@app.post("/api/jobs")
async def create_job(file: UploadFile = File(...), settings: str = Form("{}")):
    if not jobs.kind_of(file.filename or ""):
        raise HTTPException(400, "Unsupported file type")
    s = _clean(json.loads(settings))
    with tempfile.NamedTemporaryFile(delete=False, dir=jobs.DATA, suffix=".upload") as tmp:
        shutil.copyfileobj(file.file, tmp)
    return jobs.public(jobs.create(file.filename, Path(tmp.name), s))


@app.post("/api/jobs/{jid}/rerun")
def rerun_job(jid: str, settings: dict):
    """Run the same source again with new settings (e.g. after approving a preview)."""
    j = jobs.get(jid)
    if not j:
        raise HTTPException(404)
    s = _clean(settings)
    with tempfile.NamedTemporaryFile(delete=False, dir=jobs.DATA, suffix=".upload") as tmp:
        tmp.close()
        shutil.copyfile(jobs.DATA / jid / j["files"]["source"], tmp.name)
    return jobs.public(jobs.create(j["name"], Path(tmp.name), s))


@app.get("/api/jobs")
def list_jobs():
    return jobs.list_jobs()


@app.get("/api/jobs/{jid}")
def get_job(jid: str):
    j = jobs.get(jid)
    if not j:
        raise HTTPException(404)
    return jobs.public(j)


@app.post("/api/jobs/{jid}/cancel")
def cancel_job(jid: str):
    jobs.cancel(jid)
    return {"ok": True}


@app.delete("/api/jobs/{jid}")
def delete_job(jid: str):
    jobs.delete(jid)
    return {"ok": True}


@app.get("/api/jobs/{jid}/files/{name}")
def job_file(jid: str, name: str, download: bool = False):
    j = jobs.get(jid)
    if not j or name not in j["files"].values():
        raise HTTPException(404)
    path = jobs.DATA / jid / name
    dl = j.get("result", {}).get("download_name") if download and name == j["files"].get("output") else None
    return FileResponse(path, filename=dl) if dl else FileResponse(path)


if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="ui")

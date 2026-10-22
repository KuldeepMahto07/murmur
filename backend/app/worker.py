"""Single background worker: one job at a time, so a 4 GB GPU never holds two models."""
import logging
import threading
import time
import traceback
from pathlib import Path

from sqlmodel import Session, select

from . import diarize, pipeline
from .db import Job, engine, utcnow

log = logging.getLogger("murmur.worker")
_wake = threading.Event()


def notify():
    _wake.set()


def _update(job_id: str, **fields):
    with Session(engine) as s:
        job = s.get(Job, job_id)
        if job is None:
            raise LookupError("job deleted")
        for k, v in fields.items():
            setattr(job, k, v)
        s.add(job)
        s.commit()


def _download_url(job: Job, progress) -> Path:
    import yt_dlp

    def hook(d):
        if d.get("status") == "downloading" and d.get("total_bytes"):
            progress("Downloading", 0.05 * d["downloaded_bytes"] / d["total_bytes"])

    opts = {
        "format": "bestaudio/best",
        "outtmpl": str(job.folder / "source.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "progress_hooks": [hook],
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(job.source_url, download=True)
        path = Path(ydl.prepare_filename(info))
    title = info.get("title")
    _update(job.id, media_file=path.name, **({"title": title} if title else {}))
    return path


def process(job_id: str):
    with Session(engine) as s:
        job = s.get(Job, job_id)
    last = [0.0]

    def progress(stage: str, frac: float):
        now = time.monotonic()
        if now - last[0] > 0.5 or frac >= 1:
            last[0] = now
            _update(job_id, stage=stage, progress=round(min(frac, 1.0), 4))

    folder = job.folder
    folder.mkdir(parents=True, exist_ok=True)
    if job.source_type == "url" and not job.media_file:
        progress("Downloading", 0.0)
        src = _download_url(job, progress)
    else:
        src = folder / job.media_file

    progress("Preparing audio", 0.01)
    wav = folder / "audio16k.wav"
    pipeline.prepare_audio(src, wav, job.clean_audio)
    _update(job_id, duration=pipeline.probe_duration(wav))

    t = pipeline.transcribe(wav, mode=job.mode, language=job.language,
                            to_english=job.translate_to_english, progress=progress)
    _update(job_id, detected_language=t["source_language"], duration=t["duration"])

    if job.diarize:
        progress("Recognizing speakers", 0.82)
        regions = [(sg["start"], sg["end"]) for sg in t["segments"]]
        turns, method = diarize.diarize(wav, job.num_speakers, regions)
        t = pipeline.assign_speakers(t, turns)
        _update(job_id, diarization_method=method)

    pipeline.save_json(folder / "transcript.json", pipeline.finalize(t))
    wav.unlink(missing_ok=True)
    _update(job_id, status="done", stage="Done", progress=1.0, finished_at=utcnow())


def _loop():
    while True:
        with Session(engine) as s:
            job = s.exec(select(Job).where(Job.status == "queued").order_by(Job.created_at)).first()
            job_id = job.id if job else None
        if job_id is None:
            _wake.wait(timeout=5)
            _wake.clear()
            continue
        _update(job_id, status="running", stage="Starting", progress=0.0, error=None)
        try:
            process(job_id)
        except LookupError:
            log.info("job %s was deleted mid-run", job_id)
        except Exception as e:
            log.error("job %s failed:\n%s", job_id, traceback.format_exc())
            try:
                _update(job_id, status="failed", stage="Failed", error=str(e)[:1000])
            except LookupError:
                pass


def start():
    threading.Thread(target=_loop, name="murmur-worker", daemon=True).start()

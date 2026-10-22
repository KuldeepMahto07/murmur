"""In-process job queue: one GPU worker thread, jobs persisted as JSON under data/jobs/<id>/."""
from __future__ import annotations

import json
import queue
import threading
import time
import traceback
import uuid
from pathlib import Path

import cv2
import numpy as np

from . import engine, video

DATA = Path(__file__).resolve().parents[2] / "data" / "jobs"
DATA.mkdir(parents=True, exist_ok=True)

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}
VIDEO_EXT = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}
IMAGE_OUT = {"png": (".png", []), "jpg": (".jpg", [cv2.IMWRITE_JPEG_QUALITY, 95]), "webp": (".webp", [cv2.IMWRITE_WEBP_QUALITY, 95])}

_jobs: dict[str, dict] = {}
_q: "queue.Queue[str]" = queue.Queue()
_mu = threading.Lock()


def _dir(jid: str) -> Path:
    return DATA / jid


def _save(job: dict) -> None:
    (_dir(job["id"]) / "job.json").write_text(json.dumps(job, indent=1))


def public(job: dict) -> dict:
    j = {k: v for k, v in job.items() if not k.startswith("_")}
    j["urls"] = {name: f"/api/jobs/{job['id']}/files/{fn}" for name, fn in job.get("files", {}).items()}
    return j


def list_jobs() -> list[dict]:
    with _mu:
        return [public(j) for j in sorted(_jobs.values(), key=lambda j: j["created"], reverse=True)]


def get(jid: str) -> dict | None:
    return _jobs.get(jid)


def load_existing() -> None:
    for p in DATA.glob("*/job.json"):
        try:
            j = json.loads(p.read_text())
        except Exception:
            continue
        if j["status"] in ("queued", "running"):
            j.update(status="error", message="Interrupted by restart")
        _jobs[j["id"]] = j


def kind_of(filename: str) -> str | None:
    ext = Path(filename).suffix.lower()
    return "image" if ext in IMAGE_EXT else "video" if ext in VIDEO_EXT else None


def create(filename: str, data_path: Path, settings: dict) -> dict:
    jid = time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6]
    d = _dir(jid)
    d.mkdir(parents=True)
    src = d / ("source" + Path(filename).suffix.lower())
    data_path.replace(src)
    kind = kind_of(filename)
    job = {
        "id": jid, "kind": kind, "name": filename, "settings": settings,
        "status": "queued", "progress": 0.0, "message": "Waiting in queue",
        "created": time.time(), "files": {"source": src.name}, "info": {}, "result": {},
    }
    try:
        if kind == "video":
            job["info"] = video.probe(src)
        else:
            img = cv2.imread(str(src), cv2.IMREAD_UNCHANGED)
            job["info"] = {"width": img.shape[1], "height": img.shape[0], "channels": 1 if img.ndim == 2 else img.shape[2]}
    except Exception as e:  # unreadable input
        job.update(status="error", message=f"Could not read file: {e}")
    with _mu:
        _jobs[jid] = job
    _save(job)
    if job["status"] == "queued":
        _q.put(jid)
    return job


def cancel(jid: str) -> None:
    job = _jobs.get(jid)
    if job and job["status"] in ("queued", "running"):
        job["_cancel"] = True
        if job["status"] == "queued":
            job.update(status="cancelled", message="Cancelled")
            _save(job)


def delete(jid: str) -> None:
    import shutil

    cancel(jid)
    with _mu:
        _jobs.pop(jid, None)
    shutil.rmtree(_dir(jid), ignore_errors=True)


def _progress(job: dict, p: float, msg: str) -> None:
    job["progress"], job["message"] = round(p, 4), msg


def _run_image(job: dict) -> None:
    s = job["settings"]
    d = _dir(job["id"])
    img = cv2.imread(str(d / job["files"]["source"]), cv2.IMREAD_UNCHANGED)
    h, w = img.shape[:2]
    scale = float(s.get("scale") or 4)
    tw, th = int(round(w * scale)), int(round(h * scale))
    _progress(job, 0.1, f"Upscaling {w}×{h} → {tw}×{th}")
    out = engine.upscale_image_any(img, preset_id=s["preset"], out_size=(tw, th), denoise=s["denoise"],
                                   sharpen=s["sharpen"], faces=s["faces"])
    fmt = s.get("image_format", "png")
    ext, params = IMAGE_OUT[fmt]
    if out.ndim == 3 and out.shape[2] == 4 and fmt == "jpg":
        out = out[:, :, :3]
    name = Path(job["name"]).stem + f"_clarion_{scale:g}x{ext}"
    cv2.imwrite(str(d / ("output" + ext)), out, params)
    job["files"]["output"] = "output" + ext
    # browser-friendly before image (some sources, e.g. TIFF, don't render in <img>)
    if Path(job["files"]["source"]).suffix not in (".png", ".jpg", ".jpeg", ".webp"):
        cv2.imwrite(str(d / "before.png"), img)
        job["files"]["before"] = "before.png"
    else:
        job["files"]["before"] = job["files"]["source"]
    job["files"]["after"] = job["files"]["output"]
    job["result"] = {"width": tw, "height": th, "download_name": name}


def _run_video(job: dict) -> None:
    s = job["settings"]
    d = _dir(job["id"])
    src = d / job["files"]["source"]
    info = job["info"]
    out_wh = video.output_size(info["width"], info["height"], s.get("scale"), s.get("target"))
    seconds = s.get("preview_seconds") if s.get("preview") else None
    codec = s.get("codec", "h264")
    ext = video.CODECS[codec][1]
    out = d / ("output" + ext)
    fps_target = float(s["fps"]) if s.get("fps") not in (None, "", "source") else None
    slowmo = int(s.get("slowmo") or 1)
    res = video.process_video(
        src, out, preset=s["preset"], out_wh=out_wh, codec=codec, denoise=s["denoise"], sharpen=s["sharpen"],
        faces=s["faces"], fps_target=fps_target, slowmo=slowmo, seconds=seconds,
        on_progress=lambda p, m: _progress(job, p * 0.95, m), cancelled=lambda: job.get("_cancel", False),
    )
    job["files"]["output"] = out.name
    _progress(job, 0.96, "Building comparison clips")
    filters, _ = video._interp_filter(info["fps"], fps_target, slowmo)
    video.make_proxy(src, d / "before.mp4", seconds=seconds, filters=filters, max_w=1920)
    job["files"]["before"] = "before.mp4"
    if codec == "h264" and out_wh[0] <= 1920:
        job["files"]["after"] = out.name
    else:
        video.make_proxy(out, d / "after.mp4", max_w=1920)
        job["files"]["after"] = "after.mp4"
    tag = "preview" if seconds else "full"
    res["download_name"] = Path(job["name"]).stem + f"_clarion_{out_wh[1]}p_{tag}{ext}"
    job["result"] = res


def _worker() -> None:
    while True:
        jid = _q.get()
        job = _jobs.get(jid)
        if not job or job["status"] != "queued":
            continue
        job.update(status="running", started=time.time(), message="Loading model")
        _save(job)
        try:
            (_run_image if job["kind"] == "image" else _run_video)(job)
            job.update(status="done", progress=1.0, message="Done")
        except InterruptedError:
            job.update(status="cancelled", message="Cancelled")
        except Exception as e:
            traceback.print_exc()
            job.update(status="error", message=str(e)[:500])
        job["finished"] = time.time()
        job.pop("_cancel", None)
        _save(job)


def start() -> None:
    load_existing()
    threading.Thread(target=_worker, daemon=True, name="clarion-gpu").start()

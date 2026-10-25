"""ffmpeg helpers: probing, frame sampling, audio decode, downloads."""
from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np

SR = 48000  # mix sample rate


@dataclass
class VideoInfo:
    path: Path
    width: int
    height: int
    fps: float
    duration: float
    has_audio: bool


def probe(path: Path) -> VideoInfo:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    data = json.loads(out)
    v = next(s for s in data["streams"] if s["codec_type"] == "video")
    num, den = (v.get("avg_frame_rate") or v.get("r_frame_rate") or "30/1").split("/")
    fps = float(num) / float(den or 1) if float(num) else 30.0
    w, h = int(v["width"]), int(v["height"])
    rot = int((v.get("tags") or {}).get("rotate", 0) or 0)
    for sd in v.get("side_data_list") or []:
        rot = int(sd.get("rotation", rot) or rot)
    if abs(rot) in (90, 270):
        w, h = h, w
    duration = float(data["format"].get("duration") or v.get("duration") or 0)
    has_audio = any(s["codec_type"] == "audio" for s in data["streams"])
    return VideoInfo(path, w, h, fps, duration, has_audio)


def output_geometry(info: VideoInfo, max_side: int = 1920) -> tuple[int, int, float]:
    """Even output size (long side capped) and output fps (30 unless the source is slower)."""
    scale = min(1.0, max_side / max(info.width, info.height))
    w = int(info.width * scale) // 2 * 2
    h = int(info.height * scale) // 2 * 2
    fps = 30.0 if info.fps >= 29 else round(info.fps, 3)
    return w, h, fps


def sample_frames(path: Path, out_dir: Path, every: float, width: int = 640) -> list[tuple[float, Path]]:
    """One JPEG every `every` seconds, named by timestamp."""
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.jpg"):
        old.unlink()
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(path),
         "-vf", f"fps=1/{every},scale={width}:-2", "-q:v", "4", str(out_dir / "f_%04d.jpg")],
        check=True,
    )
    frames = sorted(out_dir.glob("f_*.jpg"))
    # fps=1/N emits the frame nearest the middle of each N-second window
    return [((i + 0.5) * every, f) for i, f in enumerate(frames)]


def grab_frame(path: Path, t: float, out: Path, width: int = 960) -> Path:
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", str(path),
         "-frames:v", "1", "-vf", f"scale={width}:-2", str(out)],
        check=True,
    )
    return out


def decode_audio(path: Path, channels: int = 2) -> np.ndarray:
    """Whole audio track as float32 (n, channels) at SR. Empty array if none."""
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-vn", "-ac", str(channels),
         "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True,
    )
    if proc.returncode != 0 or not proc.stdout:
        return np.zeros((0, channels), dtype=np.float32)
    return np.frombuffer(proc.stdout, dtype=np.float32).reshape(-1, channels).copy()


def write_wav(path: Path, audio: np.ndarray) -> None:
    pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2")
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", str(audio.shape[1]),
         "-i", "-", str(path)],
        input=pcm.tobytes(), check=True,
    )


def fetch(source: str, work: Path) -> Path:
    """Copy a local file into the work dir, or download a URL with yt-dlp."""
    work.mkdir(parents=True, exist_ok=True)
    existing = list(work.glob("source.*"))
    if existing:
        return existing[0]
    if source.startswith(("http://", "https://")):
        subprocess.run(
            ["yt-dlp", "-f", "bv*[height<=1080]+ba/b[height<=1080]/b", "--merge-output-format", "mp4",
             "-o", str(work / "source.%(ext)s"), source],
            check=True,
        )
        return next(work.glob("source.*"))
    src = Path(source)
    dst = work / f"source{src.suffix.lower()}"
    shutil.copyfile(src, dst)
    return dst

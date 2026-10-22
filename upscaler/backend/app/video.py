"""Video pipeline: ffmpeg decodes raw frames -> engine upscales each frame -> ffmpeg encodes, muxing the source audio."""
from __future__ import annotations

import json
import subprocess
import threading
import time
from fractions import Fraction
from pathlib import Path
from typing import Callable

import numpy as np

from . import engine

NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)

CODECS = {
    # id: (label, extension, ffmpeg video args)
    "h264": ("H.264 (MP4)", ".mp4", ["-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p"]),
    "h265": ("H.265 10-bit (MP4)", ".mp4", ["-c:v", "libx265", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p10le", "-tag:v", "hvc1"]),
    "prores": ("ProRes 422 HQ (MOV)", ".mov", ["-c:v", "prores_ks", "-profile:v", "3", "-pix_fmt", "yuv422p10le"]),
}


def probe(path: Path) -> dict:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(path)],
        capture_output=True, text=True, check=True, creationflags=NO_WINDOW,
    )
    d = json.loads(r.stdout)
    v = next(s for s in d["streams"] if s["codec_type"] == "video")
    fps = Fraction(v.get("avg_frame_rate") or v.get("r_frame_rate") or "30/1")
    if fps == 0:
        fps = Fraction(v.get("r_frame_rate", "30/1"))
    duration = float(v.get("duration") or d["format"].get("duration") or 0)
    w, h = int(v["width"]), int(v["height"])
    rot = 0
    for sd in v.get("side_data_list", []) or []:
        rot = int(sd.get("rotation", 0) or 0)
    if abs(rot) in (90, 270):
        w, h = h, w
    return {
        "width": w,
        "height": h,
        "fps": float(fps),
        "fps_frac": f"{fps.numerator}/{fps.denominator}",
        "duration": duration,
        "frames": int(v.get("nb_frames") or round(duration * float(fps))),
        "codec": v.get("codec_name"),
        "has_audio": any(s["codec_type"] == "audio" for s in d["streams"]),
    }


def even(n: float) -> int:
    return max(2, int(round(n / 2)) * 2)


def output_size(src_w: int, src_h: int, scale: float | None, target: str | None) -> tuple[int, int]:
    """target: '1080p' / '1440p' / '4k' fits the short side (landscape) or long side cap; else plain scale factor."""
    if target:
        short = {"720p": 720, "1080p": 1080, "1440p": 1440, "4k": 2160}[target]
        long_cap = {"720p": 1280, "1080p": 1920, "1440p": 2560, "4k": 3840}[target]
        k = min(short / min(src_w, src_h), long_cap / max(src_w, src_h))
        return even(src_w * k), even(src_h * k)
    return even(src_w * (scale or 2)), even(src_h * (scale or 2))


def _interp_filter(src_fps: float, fps_target: float | None, slowmo: int) -> tuple[list[str], float]:
    """Returns (filters, output fps). Motion-compensated interpolation runs at source resolution, before upscaling."""
    if slowmo and slowmo > 1:
        return [f"minterpolate=fps={src_fps * slowmo:.6f}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1",
                f"setpts={slowmo}*PTS"], src_fps
    if fps_target and abs(fps_target - src_fps) > 0.01:
        if fps_target > src_fps:
            return [f"minterpolate=fps={fps_target}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"], fps_target
        return [f"fps={fps_target}"], fps_target
    return [], src_fps


def process_video(
    src: Path,
    out_path: Path,
    *,
    preset: str,
    out_wh: tuple[int, int],
    codec: str = "h264",
    denoise: float = 0.5,
    sharpen: float = 0.0,
    faces: bool = False,
    fps_target: float | None = None,
    slowmo: int = 1,
    seconds: float | None = None,
    on_progress: Callable[[float, str], None] = lambda p, m: None,
    cancelled: Callable[[], bool] = lambda: False,
) -> dict:
    info = probe(src)
    w, h = info["width"], info["height"]
    filters, out_fps = _interp_filter(info["fps"], fps_target, slowmo)
    dur = min(info["duration"], seconds) if seconds else info["duration"]
    est_frames = max(1, int(round(dur * info["fps"] * (slowmo if slowmo > 1 else 1)
                                  * ((fps_target / info["fps"]) if (fps_target and not slowmo > 1) else 1))))

    dec_cmd = ["ffmpeg", "-v", "error"]
    if seconds:
        dec_cmd += ["-t", f"{seconds}"]
    dec_cmd += ["-i", str(src)]
    if filters:
        dec_cmd += ["-vf", ",".join(filters)]
    dec_cmd += ["-f", "rawvideo", "-pix_fmt", "bgr24", "-vsync", "passthrough", "-"]

    tw, th = out_wh
    keep_audio = info["has_audio"] and not (slowmo and slowmo > 1)
    enc_cmd = ["ffmpeg", "-v", "error", "-y",
               "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{tw}x{th}", "-r", f"{out_fps:.6f}", "-i", "-"]
    if keep_audio:
        if seconds:
            enc_cmd += ["-t", f"{seconds}"]
        enc_cmd += ["-i", str(src), "-map", "0:v:0", "-map", "1:a:0?"]
    enc_cmd += CODECS[codec][2]
    if keep_audio:
        enc_cmd += ["-c:a", "aac", "-b:a", "192k"] if codec != "prores" else ["-c:a", "pcm_s16le"]
        enc_cmd += ["-shortest"]
    enc_cmd += ["-movflags", "+faststart", str(out_path)] if out_path.suffix == ".mp4" else [str(out_path)]

    dec = subprocess.Popen(dec_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, creationflags=NO_WINDOW)
    enc = subprocess.Popen(enc_cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE, creationflags=NO_WINDOW)
    enc_err: list[bytes] = []
    threading.Thread(target=lambda: enc_err.append(enc.stderr.read()), daemon=True).start()

    frame_bytes = w * h * 3
    n = 0
    t0 = time.time()
    try:
        while True:
            if cancelled():
                raise InterruptedError("cancelled")
            buf = dec.stdout.read(frame_bytes)
            if len(buf) < frame_bytes:
                break
            frame = np.frombuffer(buf, np.uint8).reshape(h, w, 3)
            up = engine.upscale_bgr(frame, preset_id=preset, out_size=(tw, th),
                                    denoise=denoise, sharpen=sharpen, faces=faces)
            enc.stdin.write(np.ascontiguousarray(up).tobytes())
            n += 1
            el = time.time() - t0
            rate = n / el if el else 0
            eta = (est_frames - n) / rate if rate else 0
            on_progress(min(0.99, n / est_frames), f"Frame {n}/{est_frames} · {rate:.1f} fps · ~{eta:.0f}s left")
    finally:
        try:
            enc.stdin.close()
        except OSError:
            pass
        dec.kill()
        enc.wait()
    if enc.returncode != 0:
        raise RuntimeError("Encoder failed: " + b"".join(enc_err).decode(errors="ignore")[-600:])
    if n == 0:
        raise RuntimeError("No frames decoded: " + dec.stderr.read().decode(errors="ignore")[-600:])
    return {"frames": n, "fps": out_fps, "seconds": round(time.time() - t0, 1), "width": tw, "height": th}


def make_proxy(src: Path, dst: Path, *, seconds: float | None = None, filters: list[str] | None = None,
               max_w: int | None = None, size: tuple[int, int] | None = None) -> None:
    """Browser-playable H.264 copy for the comparison player."""
    vf = list(filters or [])
    if size:
        vf.append(f"scale={size[0]}:{size[1]}:flags=neighbor")
    elif max_w:
        vf.append(f"scale='min({max_w},iw)':-2")
    cmd = ["ffmpeg", "-v", "error", "-y"]
    if seconds:
        cmd += ["-t", f"{seconds}"]
    cmd += ["-i", str(src)]
    if vf:
        cmd += ["-vf", ",".join(vf)]
    cmd += ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", str(dst)]
    subprocess.run(cmd, check=True, capture_output=True, creationflags=NO_WINDOW)

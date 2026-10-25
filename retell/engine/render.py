"""Turns a plan into the finished video: one forward pass over the source frames plus one audio mix."""
from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image

from . import sfx
from .draw import ease, render_frame
from .media import SR, VideoInfo, decode_audio, grab_frame, output_geometry, write_wav
from .plan import Beat, Effect, Plan
from .voice import DEFAULT_VOICE, Line, speak

FREEZE_LEAD = 0.30   # silence (sfx + zoom-in) before narration starts on a freeze
FREEZE_TAIL = 0.35
OVER_DUCK = 0.22     # original audio level under "over" narration
CAPTION_WORDS = 3


@dataclass
class Segment:
    kind: str              # play | freeze | over
    src_start: float
    duration: float
    beat: Beat | None = None
    line: Line | None = None
    voice_at: float = 0.0  # narration offset inside the segment (negative when it started in an earlier segment)
    speaks: bool = True    # False on a hold that only continues an earlier segment's line
    out_start: float = 0.0
    chunks: list[tuple[float, float, list[str], int]] = field(default_factory=list)


def _chunks(line: Line, offset: float) -> list[tuple[float, float, list[str], int]]:
    """Group word timings into caption chunks of up to CAPTION_WORDS words, times relative to the segment."""
    out = []
    words = line.words
    for i in range(0, len(words), CAPTION_WORDS):
        group = words[i:i + CAPTION_WORDS]
        end = words[i + CAPTION_WORDS][0] if i + CAPTION_WORDS < len(words) else group[-1][1] + 0.25
        out.append((offset + group[0][0], offset + end, [g[2] for g in group], i))
    return out


def build_timeline(plan: Plan, info: VideoInfo, cache: Path, voice: str) -> list[Segment]:
    fps_step = 1 / 30
    end = max(0.0, info.duration - fps_step)
    segs: list[Segment] = []
    cur = 0.0
    beats = [b for b in sorted(plan.beats, key=lambda b: b.t) if b.narration.strip()]
    for k, b in enumerate(beats):
        t = min(max(b.t, cur), end)
        if t - cur > fps_step:
            segs.append(Segment("play", cur, t - cur))
        line = speak(b.narration, cache, voice)
        # an "over" line may only run the clip up to the next beat, so later freezes land on their own frame
        room = min(beats[k + 1].t if k + 1 < len(beats) else info.duration, info.duration) - t
        need = line.duration + 0.2
        if b.mode == "over" and room >= min(need, 1.0):
            run = min(need, room)
            segs.append(Segment("over", t, run, b, line, 0.0))
            cur = t + run
            if need > run:  # hold on the frame we reached until the line finishes
                hold = Beat(t=cur, mode="freeze", narration=b.narration)
                segs.append(Segment("freeze", min(cur, end), need - run, hold, line, -run, speaks=False))
        else:
            segs.append(Segment("freeze", t, FREEZE_LEAD + line.duration + FREEZE_TAIL, b, line, FREEZE_LEAD))
            cur = t
    if info.duration - cur > fps_step:
        segs.append(Segment("play", cur, info.duration - cur))
    if plan.outro.strip():
        line = speak(plan.outro, cache, voice)
        segs.append(Segment("freeze", end, FREEZE_LEAD + line.duration + FREEZE_TAIL + 0.4,
                            Beat(t=end, mode="freeze", narration=plan.outro), line, FREEZE_LEAD))
    t = 0.0
    for s in segs:
        s.out_start = t
        t += s.duration
        if s.line:
            s.chunks = _chunks(s.line, s.voice_at)
    return segs


class FrameSource:
    """Sequential decoder at the output fps/size; frames are only ever requested in forward order."""

    def __init__(self, path: Path, w: int, h: int, fps: float):
        self.w, self.h = w, h
        self.size = w * h * 3
        self.proc = subprocess.Popen(
            ["ffmpeg", "-v", "error", "-i", str(path), "-vf", f"fps={fps},scale={w}:{h}",
             "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            stdout=subprocess.PIPE,
        )
        self.index = -1
        self.frame = np.zeros((h, w, 3), dtype=np.uint8)

    def get(self, index: int) -> np.ndarray:
        while self.index < index:
            buf = self.proc.stdout.read(self.size)
            if len(buf) < self.size:
                break  # past the end: hold the last frame
            self.frame = np.frombuffer(buf, dtype=np.uint8).reshape(self.h, self.w, 3)
            self.index += 1
        return self.frame

    def close(self) -> None:
        self.proc.stdout.close()
        self.proc.kill()


def render(plan: Plan, info: VideoInfo, work: Path, voice: str = DEFAULT_VOICE,
           music: Path | None = None, out: Path | None = None) -> Path:
    w, h, fps = output_geometry(info)
    segs = build_timeline(plan, info, work / "voice", voice)
    total = sum(s.duration for s in segs)
    n_frames = int(round(total * fps))
    out = out or work / "output.mp4"
    silent = work / "video_only.mp4"

    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(fps),
         "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", str(silent)],
        stdin=subprocess.PIPE,
    )
    src = FrameSource(info.path, w, h, fps)
    si = 0
    try:
        for fi in range(n_frames):
            t_out = fi / fps
            while si < len(segs) - 1 and t_out >= segs[si].out_start + segs[si].duration:
                si += 1
            s = segs[si]
            local = t_out - s.out_start
            if s.kind == "freeze":
                frame = src.get(int(round(s.src_start * fps)))
            else:
                frame = src.get(int(round((s.src_start + local) * fps)))
            enc.stdin.write(_compose(frame, s, local).tobytes())
    finally:
        src.close()
        enc.stdin.close()
        enc.wait()

    mix = mix_audio(segs, info, total, music)
    wav = work / "mix.wav"
    write_wav(wav, mix)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(wav), "-c:v", "copy", "-c:a", "aac",
         "-b:a", "192k", "-movflags", "+faststart", "-shortest", str(out)],
        check=True,
    )
    silent.unlink(missing_ok=True)
    return out


def _compose(frame: np.ndarray, s: Segment, local: float) -> np.ndarray:
    b = s.beat
    if b is None:
        return frame
    zoom = 1 + (max(1.0, min(2.5, b.zoom)) - 1) * ease(local / 0.45)
    progress = (local - 0.15) / 0.45
    caption = None
    for start, end, words, first in s.chunks:
        if start <= local < end:
            spoken = sum(1 for ws, _, _ in s.line.words if s.voice_at + ws <= local)
            caption = (words, min(len(words) - 1, max(0, spoken - 1 - first)))
            break
    if zoom <= 1.001 and b.effect.type == "none" and caption is None:
        return frame
    return render_frame(frame, zoom, b.effect, max(0.0, progress), caption)


def _add(track: np.ndarray, clip: np.ndarray, at: float, gain: float = 1.0) -> None:
    i = int(at * SR)
    if i >= len(track) or len(clip) == 0:
        return
    n = min(len(clip), len(track) - i)
    track[i:i + n] += clip[:n] * gain


def mix_audio(segs: list[Segment], info: VideoInfo, total: float, music: Path | None) -> np.ndarray:
    track = np.zeros((int(total * SR) + SR, 2), dtype=np.float32)
    source = decode_audio(info.path) if info.has_audio else np.zeros((0, 2), dtype=np.float32)
    fade = int(0.015 * SR)
    for s in segs:
        if s.kind in ("play", "over") and len(source):
            a, b = int(s.src_start * SR), int((s.src_start + s.duration) * SR)
            piece = source[a:b].copy()
            if len(piece) > 2 * fade:  # tiny fades so cuts into/out of freezes don't click
                ramp = np.linspace(0, 1, fade, dtype=np.float32)[:, None]
                piece[:fade] *= ramp
                piece[-fade:] *= ramp[::-1]
            _add(track, piece, s.out_start, OVER_DUCK if s.kind == "over" else 1.0)
        if s.line is not None and s.speaks:
            _add(track, s.line.audio, s.out_start + s.voice_at, 1.0)
        if s.beat is not None and s.beat.sfx != "none":
            fx = sfx.get(s.beat.sfx)
            if fx is not None:
                _add(track, fx, s.out_start, 0.55)
    if music is not None:
        bed = decode_audio(music)
        if len(bed):
            reps = int(np.ceil(len(track) / len(bed)))
            bed = np.tile(bed, (reps, 1))[: len(track)]
            # duck the music further wherever narration is playing
            gain = np.full(len(track), 0.14, dtype=np.float32)
            for s in segs:
                if s.line is not None and s.speaks:
                    a = int((s.out_start + s.voice_at) * SR)
                    gain[a:a + len(s.line.audio)] = 0.06
            track += bed * gain[:, None]
    track = track[: int(total * SR)]
    peak = np.abs(track).max() if len(track) else 0
    if peak > 0.98:
        track *= 0.98 / peak
    return track


def contact_sheet(plan: Plan, info: VideoInfo, work: Path) -> Path:
    """One tile per beat showing its frame with the effect fully drawn, for checking positions before rendering."""
    tiles = []
    tmp = work / "sheet"
    tmp.mkdir(exist_ok=True)
    for i, b in enumerate(plan.beats):
        f = grab_frame(info.path, min(b.t, max(0, info.duration - 0.05)), tmp / f"b{i:02d}.png", 640)
        arr = np.asarray(Image.open(f).convert("RGB"))
        tile = Image.fromarray(render_frame(arr, max(1.0, b.zoom), b.effect, 1.0, None))
        _stamp(tile, f"#{i + 1}  t={b.t:.1f}s  {b.mode}  {b.effect.type}  sfx={b.sfx}")
        tiles.append(tile)
    if not tiles:
        raise ValueError("plan has no beats")
    tw, th = tiles[0].size
    cols = 3 if tw >= th else 5
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, rows * th), (20, 20, 20))
    for i, tile in enumerate(tiles):
        sheet.paste(tile.resize((tw, th)), ((i % cols) * tw, (i // cols) * th))
    out = work / "sheet.jpg"
    sheet.save(out, quality=85)
    return out


def _stamp(img: Image.Image, text: str) -> None:
    from PIL import ImageDraw
    from .draw import font
    d = ImageDraw.Draw(img)
    f = font(max(14, img.width // 34))
    d.rectangle((0, 0, img.width, f.size + 10), fill=(0, 0, 0))
    d.text((6, 4), text, font=f, fill=(255, 255, 255))

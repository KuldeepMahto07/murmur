"""Narration with Edge TTS (free, no key), keeping word timings for captions."""
from __future__ import annotations

import asyncio
import hashlib
import json
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .media import SR

DEFAULT_VOICE = "en-US-AndrewMultilingualNeural"


@dataclass
class Line:
    audio: np.ndarray            # (n, 2) float32 at SR
    words: list[tuple[float, float, str]]  # (start, end, word) in seconds from line start

    @property
    def duration(self) -> float:
        return len(self.audio) / SR


async def _synth(text: str, voice: str, rate: str, mp3: Path) -> list[dict]:
    import edge_tts

    try:
        comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    except TypeError:  # older edge-tts always sends word boundaries
        comm = edge_tts.Communicate(text, voice, rate=rate)
    words = []
    with mp3.open("wb") as fh:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                fh.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 1e7
                words.append({"start": start, "end": start + chunk["duration"] / 1e7, "text": chunk["text"]})
    return words


def speak(text: str, cache: Path, voice: str = DEFAULT_VOICE, rate: str = "+8%") -> Line:
    cache.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(f"{voice}|{rate}|{text}".encode()).hexdigest()[:16]
    mp3, meta = cache / f"{key}.mp3", cache / f"{key}.json"
    if not (mp3.exists() and meta.exists()):
        for attempt in range(4):  # the free Edge endpoint drops requests now and then
            try:
                words = asyncio.run(_synth(text, voice, rate, mp3))
                break
            except Exception as err:
                mp3.unlink(missing_ok=True)
                if attempt == 3:
                    raise RuntimeError(f"Edge TTS failed for: {text[:60]}") from err
                time.sleep(2 * (attempt + 1))
        meta.write_text(json.dumps(words), encoding="utf-8")
    words = json.loads(meta.read_text(encoding="utf-8"))
    pcm = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(mp3), "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    audio = np.frombuffer(pcm, dtype=np.float32).reshape(-1, 2).copy()
    # Edge TTS pads the end with silence; trim it so freezes don't drag
    loud = np.nonzero(np.abs(audio).max(axis=1) > 0.01)[0]
    if len(loud):
        audio = audio[: min(len(audio), loud[-1] + int(0.08 * SR))]
    return Line(audio, [(w["start"], w["end"], w["text"]) for w in words])

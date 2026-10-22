"""Media prep, Whisper transcription and speaker assignment."""
import json
import logging
import subprocess
from pathlib import Path
from typing import Callable

from .config import DEVICE, MODELS_DIR, MODES

log = logging.getLogger("murmur.pipeline")

Progress = Callable[[str, float], None]

_model_cache: dict = {}


def run_ffmpeg(args: list[str]):
    proc = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args],
                          capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {proc.stderr.strip()[-500:]}")


def probe_duration(path: Path) -> float | None:
    proc = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                           "-of", "default=nw=1:nk=1", str(path)], capture_output=True, text=True)
    try:
        return float(proc.stdout.strip())
    except ValueError:
        return None


def prepare_audio(src: Path, dst: Path, clean: bool):
    """Decode anything ffmpeg understands to 16 kHz mono WAV, optionally denoised."""
    af = ["-af", "highpass=f=80,lowpass=f=7800,afftdn=nf=-25,dynaudnorm"] if clean else []
    run_ffmpeg(["-i", str(src), "-vn", "-ac", "1", "-ar", "16000", *af, "-c:a", "pcm_s16le", str(dst)])


def load_wav(path: Path):
    """Read our 16-bit mono WAV as float32 samples in [-1, 1]."""
    import wave

    import numpy as np

    with wave.open(str(path), "rb") as w:
        sr = w.getframerate()
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return pcm.astype(np.float32) / 32768.0, sr


def _device() -> tuple[str, str]:
    if DEVICE == "cpu":
        return "cpu", "int8"
    try:
        import torch  # noqa: F401  (loads CUDA/cuDNN DLLs that CTranslate2 needs on Windows)
        import ctranslate2
        if ctranslate2.get_cuda_device_count() > 0:
            return "cuda", "int8_float16"
    except Exception as e:  # pragma: no cover
        log.warning("CUDA unavailable: %s", e)
    return "cpu", "int8"


def get_whisper(mode: str):
    from faster_whisper import WhisperModel

    name = MODES.get(mode, MODES["steady"])["model"]
    if name in _model_cache:
        return _model_cache[name]
    _model_cache.clear()  # keep one model in VRAM at a time (4 GB cards)
    device, compute = _device()
    try:
        model = WhisperModel(name, device=device, compute_type=compute, download_root=str(MODELS_DIR))
    except Exception as e:
        if device == "cpu":
            raise
        log.warning("GPU load failed (%s); falling back to CPU", e)
        model = WhisperModel(name, device="cpu", compute_type="int8", download_root=str(MODELS_DIR))
    log.info("Loaded Whisper %s on %s (%s)", name, model.model.device, model.model.compute_type)
    _model_cache[name] = model
    return model


def transcribe(wav: Path, *, mode: str, language: str | None, to_english: bool, progress: Progress) -> dict:
    progress("Loading speech model", 0.02)
    model = get_whisper(mode)
    progress("Transcribing", 0.05)
    segments_iter, info = model.transcribe(
        load_wav(wav)[0],  # pass samples: faster-whisper's PyAV decoder breaks on newer PyAV
        language=language or None,
        task="translate" if to_english else "transcribe",
        word_timestamps=True,
        vad_filter=True,
        beam_size=5,
    )
    duration = info.duration or 1.0
    segments = []
    for seg in segments_iter:
        words = [{"start": round(w.start, 3), "end": round(w.end, 3), "word": w.word} for w in (seg.words or [])]
        segments.append({"start": round(seg.start, 3), "end": round(seg.end, 3),
                         "text": seg.text.strip(), "speaker": None, "words": words})
        progress("Transcribing", 0.05 + 0.75 * min(seg.end / duration, 1.0))
    return {
        "language": "en" if to_english else info.language,
        "source_language": info.language,
        "duration": info.duration,
        "segments": segments,
    }


def assign_speakers(transcript: dict, turns: list[tuple[float, float, str]]) -> dict:
    """Give each word the speaker whose turn overlaps it most, then split segments at speaker changes."""
    if not turns:
        return transcript

    def speaker_for(start: float, end: float) -> str:
        best, best_ov = None, 0.0
        mid = (start + end) / 2
        nearest, nearest_d = turns[0][2], float("inf")
        for ts, te, spk in turns:
            ov = min(end, te) - max(start, ts)
            if ov > best_ov:
                best, best_ov = spk, ov
            d = 0 if ts <= mid <= te else min(abs(mid - ts), abs(mid - te))
            if d < nearest_d:
                nearest, nearest_d = spk, d
        return best or nearest

    out = []
    for seg in transcript["segments"]:
        words = seg.get("words") or []
        if not words:
            seg["speaker"] = speaker_for(seg["start"], seg["end"])
            out.append(seg)
            continue
        for w in words:
            w["speaker"] = speaker_for(w["start"], w["end"])
        cur: list = []
        for w in words:
            if cur and w["speaker"] != cur[-1]["speaker"]:
                out.append(_segment_from_words(cur))
                cur = []
            cur.append(w)
        if cur:
            out.append(_segment_from_words(cur))
    # A one-word blip between two passages of the same speaker is flicker: fold it back in.
    merged: list = []
    for i, seg in enumerate(out):
        nxt = out[i + 1] if i + 1 < len(out) else None
        blip = len(seg["words"]) <= 1 and seg["end"] - seg["start"] < 0.8
        if blip and merged and nxt and merged[-1]["speaker"] == nxt["speaker"] != seg["speaker"]:
            for w in seg["words"]:
                w["speaker"] = merged[-1]["speaker"]
            merged[-1] = _segment_from_words(merged[-1]["words"] + seg["words"])
            continue
        if merged and seg["speaker"] == merged[-1]["speaker"] and seg["start"] - merged[-1]["end"] < 1.0 \
                and merged[-1]["words"] and seg["words"] and len(merged[-1]["text"]) + len(seg["text"]) < 250:
            merged[-1] = _segment_from_words(merged[-1]["words"] + seg["words"])
            continue
        merged.append(seg)
    transcript["segments"] = merged
    return transcript


def _segment_from_words(words: list) -> dict:
    return {"start": words[0]["start"], "end": words[-1]["end"],
            "text": "".join(w["word"] for w in words).strip(),
            "speaker": words[0]["speaker"], "words": words}


def finalize(transcript: dict) -> dict:
    for i, seg in enumerate(transcript["segments"]):
        seg["id"] = i
    return transcript


def save_json(path: Path, data: dict):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))

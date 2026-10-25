"""Sound effects. Synthesised by default; a file named sfx/<name>.wav|mp3 overrides one."""
from __future__ import annotations

from pathlib import Path

import numpy as np

from .media import SR, decode_audio

SFX_DIR = Path(__file__).resolve().parent.parent / "sfx"
_rng = np.random.default_rng(7)


def _t(seconds: float) -> np.ndarray:
    return np.arange(int(seconds * SR)) / SR


def _lowpass(x: np.ndarray, alpha: np.ndarray | float) -> np.ndarray:
    """One-pole low-pass; alpha may vary per sample (0..1, higher = brighter)."""
    alpha = np.broadcast_to(alpha, x.shape)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += alpha[i] * (x[i] - acc)
        y[i] = acc
    return y


def _chirp(f0: float, f1: float, seconds: float) -> np.ndarray:
    t = _t(seconds)
    f = f0 * (f1 / f0) ** (t / seconds)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def pop() -> np.ndarray:
    t = _t(0.12)
    return _chirp(1400, 380, 0.12) * np.exp(-t * 38) * 0.9


def click() -> np.ndarray:
    t = _t(0.05)
    return (_chirp(3000, 1800, 0.05) * 0.5 + _rng.normal(0, 0.3, len(t))) * np.exp(-t * 120) * 0.7


def whoosh() -> np.ndarray:
    t = _t(0.55)
    env = np.sin(np.pi * np.clip(t / 0.55, 0, 1)) ** 2
    sweep = 0.02 + 0.25 * np.sin(np.pi * t / 0.55)
    return _lowpass(_rng.normal(0, 1, len(t)), sweep) * env * 2.2


def ding() -> np.ndarray:
    t = _t(1.2)
    tone = np.sin(2 * np.pi * 1318.5 * t) + 0.45 * np.sin(2 * np.pi * 2637 * t) + 0.2 * np.sin(2 * np.pi * 3955.5 * t)
    return tone * np.exp(-t * 4.2) * 0.35


def riser() -> np.ndarray:
    t = _t(1.3)
    env = (t / 1.3) ** 2
    noise = _lowpass(_rng.normal(0, 1, len(t)), 0.03 + 0.4 * t / 1.3)
    return (noise * 1.5 + _chirp(220, 1100, 1.3) * 0.3) * env * 0.8


def boom() -> np.ndarray:
    t = _t(1.1)
    body = _chirp(90, 38, 1.1) * np.exp(-t * 3.5)
    hit = _lowpass(_rng.normal(0, 1, len(t)), 0.08) * np.exp(-t * 25) * 2
    return np.tanh((body + hit) * 1.6) * 0.9


def scratch() -> np.ndarray:
    # quick back-and-forth pitch wobble over gritty noise, like a record stopping
    t = _t(0.35)
    f = 500 + 900 * np.sin(2 * np.pi * 5.5 * t) * np.exp(-t * 3)
    tone = np.sign(np.sin(2 * np.pi * np.cumsum(np.abs(f)) / SR)) * 0.25
    grit = _lowpass(_rng.normal(0, 1, len(t)), 0.25) * 0.8
    return _lowpass(tone + grit, 0.35) * np.exp(-t * 6) * 1.4


_SYNTHS = {"pop": pop, "click": click, "whoosh": whoosh, "ding": ding, "riser": riser, "boom": boom, "scratch": scratch}
_cache: dict[str, np.ndarray] = {}


def get(name: str) -> np.ndarray | None:
    """Stereo float32 (n, 2) at SR, or None for 'none'/unknown."""
    if name in _cache:
        return _cache[name]
    for ext in (".wav", ".mp3", ".ogg"):
        f = SFX_DIR / f"{name}{ext}"
        if f.exists():
            _cache[name] = decode_audio(f)
            return _cache[name]
    synth = _SYNTHS.get(name)
    if synth is None:
        return None
    mono = synth().astype(np.float32)
    mono /= max(1e-6, np.abs(mono).max()) / 0.8
    _cache[name] = np.stack([mono, mono], axis=1)
    return _cache[name]

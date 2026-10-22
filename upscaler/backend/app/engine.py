"""Image super-resolution engine: Real-ESRGAN family via spandrel, tiled fp16 on CUDA, CPU fallback."""
from __future__ import annotations

import threading
from functools import lru_cache

import cv2
import numpy as np
import torch
from spandrel import ModelLoader

from .models_registry import PRESETS, ensure

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
HALF = DEVICE.type == "cuda"
_lock = threading.Lock()  # one model run on the GPU at a time


def device_info() -> dict:
    info = {"device": DEVICE.type, "half": HALF}
    if DEVICE.type == "cuda":
        p = torch.cuda.get_device_properties(0)
        info.update(name=p.name, vram_gb=round(p.total_memory / 2**30, 1))
    return info


def _to_device(model):
    model = model.eval().to(DEVICE)
    if HALF and model.supports_half:
        model = model.half()
    return model


@lru_cache(maxsize=4)
def load_sr(preset_id: str, denoise_q: int = 50):
    """Load a preset's network. For 'balanced', blend the two general-x4v3 weights by denoise strength."""
    preset = PRESETS[preset_id]
    loader = ModelLoader()
    if preset.supports_denoise and denoise_q < 100:
        a = torch.load(ensure("general"), map_location="cpu", weights_only=True)
        b = torch.load(ensure("general_wdn"), map_location="cpu", weights_only=True)
        key = "params" if "params" in a else next(iter(a))
        sa, sb = a[key], b[key]
        w = denoise_q / 100.0
        blended = {k: w * sa[k] + (1 - w) * sb[k] for k in sa}
        desc = loader.load_from_state_dict(blended)
    else:
        desc = loader.load_from_file(ensure(preset.weight))
    return _to_device(desc)


_tile_cache: dict[tuple, int] = {}


_fp32_models: set[int] = set()  # models that overflowed in fp16 on this GPU (e.g. RRDB nets on GTX 16xx)


def _run(model, img: np.ndarray) -> np.ndarray:
    """img: HxWx3 float32 RGB in [0,1]; returns upscaled HxWx3 float32. Falls back to fp32 if fp16 gives NaNs."""
    t = torch.from_numpy(img).permute(2, 0, 1).unsqueeze(0).to(DEVICE)
    half = HALF and model.supports_half and id(model) not in _fp32_models
    with torch.inference_mode():
        out = model(t.half() if half else t)
        if half and not torch.isfinite(out).all():
            _fp32_models.add(id(model))
            model.float()
            out = model(t)
    return out.squeeze(0).float().clamp(0, 1).permute(1, 2, 0).cpu().numpy()


def _tiled(model, img: np.ndarray, tile: int, pad: int = 16) -> np.ndarray:
    h, w, _ = img.shape
    s = model.scale
    out = np.zeros((h * s, w * s, 3), np.float32)
    for y in range(0, h, tile):
        for x in range(0, w, tile):
            y0, x0 = max(y - pad, 0), max(x - pad, 0)
            y1, x1 = min(y + tile + pad, h), min(x + tile + pad, w)
            res = _run(model, img[y0:y1, x0:x1])
            ty1, tx1 = min(y + tile, h), min(x + tile, w)
            out[y * s : ty1 * s, x * s : tx1 * s] = res[(y - y0) * s : (ty1 - y0) * s, (x - x0) * s : (tx1 - x0) * s]
    return out


def sr_pass(model, rgb01: np.ndarray) -> np.ndarray:
    """Run one model pass, shrinking the tile size on out-of-memory and remembering what worked."""
    h, w, _ = rgb01.shape
    key = (id(model), h, w)
    tiles = [_tile_cache[key]] if key in _tile_cache else [0, 768, 512, 384, 256, 128]
    for tile in tiles:
        try:
            with _lock:
                out = _run(model, rgb01) if tile == 0 else _tiled(model, rgb01, tile)
            _tile_cache[key] = tile
            return out
        except torch.OutOfMemoryError:
            if DEVICE.type == "cuda":
                torch.cuda.empty_cache()
    raise RuntimeError("Not enough GPU memory even with 128px tiles")


def unsharp(img: np.ndarray, amount: float) -> np.ndarray:
    """img uint8 BGR; amount 0..1."""
    if amount <= 0:
        return img
    blur = cv2.GaussianBlur(img, (0, 0), sigmaX=1.2)
    return cv2.addWeighted(img, 1 + 1.5 * amount, blur, -1.5 * amount, 0)


def upscale_bgr(
    bgr: np.ndarray,
    preset_id: str,
    out_size: tuple[int, int],
    denoise: float = 0.5,
    sharpen: float = 0.0,
    faces: bool = False,
    face_strength: float = 0.8,
) -> np.ndarray:
    """Upscale a uint8 BGR image to exactly out_size (w, h). Repeats the model pass when the target needs it."""
    model = load_sr(preset_id, int(round(denoise * 100)))
    src_h, src_w = bgr.shape[:2]
    tw, th = out_size
    cur = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    passes = 0
    # Always one pass (1x = enhance only). Repeat only while more than 1.5x is still missing
    # (8x from a 4x model = two passes); smaller remainders are covered by Lanczos below.
    while passes == 0 or (cur.shape[1] * 1.5 < tw and passes < 3):
        cur = sr_pass(model, cur)
        passes += 1
    out = (cur * 255.0 + 0.5).clip(0, 255).astype(np.uint8)
    out = cv2.cvtColor(out, cv2.COLOR_RGB2BGR)
    if out.shape[1] != tw or out.shape[0] != th:
        interp = cv2.INTER_AREA if out.shape[1] > tw else cv2.INTER_LANCZOS4
        out = cv2.resize(out, (tw, th), interpolation=interp)
    if faces:
        from .faces import restore_faces

        out = restore_faces(bgr, out, face_strength)
    return unsharp(out, sharpen)


def upscale_image_any(img: np.ndarray, **kw) -> np.ndarray:
    """Handles gray, BGR and BGRA (alpha resized separately)."""
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    if img.dtype != np.uint8:
        img = (img / 257).astype(np.uint8) if img.dtype == np.uint16 else img.astype(np.uint8)
    alpha = None
    if img.shape[2] == 4:
        alpha, img = img[:, :, 3], img[:, :, :3]
    out = upscale_bgr(img, **kw)
    if alpha is not None:
        a = cv2.resize(alpha, (out.shape[1], out.shape[0]), interpolation=cv2.INTER_CUBIC)
        out = np.dstack([out, a])
    return out

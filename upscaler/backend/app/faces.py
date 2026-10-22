"""Face recovery: YuNet detection on the source, GFPGAN v1.4 on aligned 512px crops, feathered paste-back."""
from __future__ import annotations

from functools import lru_cache

import cv2
import numpy as np
import torch
from spandrel import ModelLoader

from . import engine
from .models_registry import ensure

# Canonical 5-point layout of a 512x512 aligned face (eyes, nose tip, mouth corners), image-left first.
TEMPLATE_512 = np.array(
    [[192.98, 239.95], [318.90, 240.19], [256.63, 314.02], [201.26, 371.41], [313.09, 371.15]], np.float32
)


@lru_cache(maxsize=1)
def _restorer():
    return engine._to_device(ModelLoader().load_from_file(ensure("gfpgan")))


@lru_cache(maxsize=4)
def _detector(w: int, h: int, min_score: float):
    return cv2.FaceDetectorYN.create(str(ensure("yunet")), "", (w, h), min_score, 0.3, 50)


def detect(bgr: np.ndarray, min_score: float = 0.7) -> list[np.ndarray]:
    """Return 5x2 landmark arrays (in bgr's pixel space) for each confident face."""
    h, w = bgr.shape[:2]
    # YuNet misses faces under ~40px; detect on a copy resized so the long side is 640px, then map back.
    s = 640 / max(h, w)
    small = cv2.resize(bgr, (round(w * s), round(h * s)), interpolation=cv2.INTER_CUBIC if s > 1 else cv2.INTER_AREA)
    _, faces = _detector(small.shape[1], small.shape[0], min_score).detect(small)
    if faces is None:
        return []
    out = []
    for f in faces:
        if f[2] / s < 12:  # too tiny to help
            continue
        out.append(f[4:14].reshape(5, 2) / s)
    return out


def _restore_crop(crop_bgr: np.ndarray) -> np.ndarray:
    """GFPGAN works in [-1, 1]; spandrel passes tensors through unchanged."""
    model = _restorer()
    rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 127.5 - 1.0
    t = torch.from_numpy(rgb).permute(2, 0, 1).unsqueeze(0).to(engine.DEVICE)
    with engine._lock, torch.inference_mode():
        out = model(t).squeeze(0).float().clamp_(-1, 1).permute(1, 2, 0).cpu().numpy()
    return cv2.cvtColor(((out + 1.0) * 127.5 + 0.5).clip(0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)


def restore_faces(src_bgr: np.ndarray, up_bgr: np.ndarray, strength: float = 0.8) -> np.ndarray:
    """Detect on the source, restore each face from the upscaled frame, blend back with a soft mask."""
    landmarks = detect(src_bgr)
    if not landmarks:
        return up_bgr
    sx = up_bgr.shape[1] / src_bgr.shape[1]
    sy = up_bgr.shape[0] / src_bgr.shape[0]
    out = up_bgr.astype(np.float32)
    H, W = up_bgr.shape[:2]
    mask512 = np.zeros((512, 512), np.float32)
    # Oval over the face only (brows to chin), feathered, so hair and background keep the upscaler's pixels.
    cv2.ellipse(mask512, (256, 300), (150, 190), 0, 0, 360, 1.0, -1)
    mask512 = cv2.GaussianBlur(mask512, (0, 0), 22)
    for lm in landmarks:
        pts = lm * np.array([sx, sy], np.float32)
        M, _ = cv2.estimateAffinePartial2D(pts, TEMPLATE_512, method=cv2.LMEDS)
        if M is None:
            continue
        crop = cv2.warpAffine(up_bgr, M, (512, 512), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        fixed = _restore_crop(crop)
        inv = cv2.invertAffineTransform(M)
        back = cv2.warpAffine(fixed, inv, (W, H), flags=cv2.INTER_LINEAR).astype(np.float32)
        m = cv2.warpAffine(mask512, inv, (W, H))[..., None] * strength
        out = out * (1 - m) + back * m
    return out.clip(0, 255).astype(np.uint8)

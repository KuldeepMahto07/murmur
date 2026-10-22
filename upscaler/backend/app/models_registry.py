"""Model catalogue: what Clarion offers and where each open-source weight file comes from."""
from __future__ import annotations

import hashlib
import urllib.request
from dataclasses import dataclass
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parents[2] / "models"

RE = "https://github.com/xinntao/Real-ESRGAN/releases/download"


@dataclass(frozen=True)
class Weight:
    file: str
    url: str
    license: str


WEIGHTS: dict[str, Weight] = {
    "general": Weight("realesr-general-x4v3.pth", f"{RE}/v0.2.5.0/realesr-general-x4v3.pth", "BSD-3-Clause"),
    "general_wdn": Weight("realesr-general-wdn-x4v3.pth", f"{RE}/v0.2.5.0/realesr-general-wdn-x4v3.pth", "BSD-3-Clause"),
    "x4plus": Weight("RealESRGAN_x4plus.pth", f"{RE}/v0.1.0/RealESRGAN_x4plus.pth", "BSD-3-Clause"),
    "x2plus": Weight("RealESRGAN_x2plus.pth", f"{RE}/v0.2.1/RealESRGAN_x2plus.pth", "BSD-3-Clause"),
    "anime": Weight("RealESRGAN_x4plus_anime_6B.pth", f"{RE}/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth", "BSD-3-Clause"),
    "gfpgan": Weight("GFPGANv1.4.pth", "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth", "Apache-2.0"),
    "yunet": Weight(
        "face_detection_yunet_2023mar.onnx",
        "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "Apache-2.0",
    ),
}


@dataclass(frozen=True)
class Preset:
    id: str
    label: str
    blurb: str
    weight: str
    native_scale: int
    supports_denoise: bool


# User-facing presets. Wording is Clarion's own.
PRESETS: dict[str, Preset] = {
    p.id: p
    for p in [
        Preset("balanced", "Balanced", "Everyday photos and footage. Tunable noise cleanup.", "general", 4, True),
        Preset("restore", "Restore", "Heavily compressed, blurry or old sources.", "x4plus", 4, False),
        Preset("illustration", "Illustration", "Anime, cartoons, CG, line art and screen captures.", "anime", 4, False),
        Preset("lite", "Lite 2x", "Gentle 2x pass that stays close to the original.", "x2plus", 2, False),
    ]
}


def weight_path(key: str) -> Path:
    return MODELS_DIR / WEIGHTS[key].file


def ensure(key: str) -> Path:
    path = weight_path(key)
    if not path.exists():
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".part")
        urllib.request.urlretrieve(WEIGHTS[key].url, tmp)
        tmp.replace(path)
    return path


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

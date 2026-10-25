"""Per-frame drawing: zoom toward a target, animated circle/arrow/spotlight, word captions."""
from __future__ import annotations

import math
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .plan import Effect

COLORS = {"yellow": (255, 212, 0), "red": (255, 45, 45), "white": (255, 255, 255), "green": (60, 230, 110)}
FONT_CANDIDATES = [
    "C:/Windows/Fonts/seguibl.ttf",   # Segoe UI Black
    "C:/Windows/Fonts/arialbd.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


@lru_cache(maxsize=16)
def font(size: int) -> ImageFont.FreeTypeFont:
    for f in FONT_CANDIDATES:
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default(size)


def ease(p: float) -> float:
    p = min(1.0, max(0.0, p))
    return 1 - (1 - p) ** 3


def crop_box(w: int, h: int, zoom: float, cx: float, cy: float) -> tuple[float, float, float, float]:
    """Source-pixel crop (x0, y0, cw, ch) for a zoom centred as close to (cx, cy) as the frame allows."""
    cw, ch = w / zoom, h / zoom
    x0 = min(max(cx * w - cw / 2, 0), w - cw)
    y0 = min(max(cy * h - ch / 2, 0), h - ch)
    return x0, y0, cw, ch


def render_frame(src: np.ndarray, zoom: float, effect: Effect | None, progress: float,
                 caption: tuple[list[str], int] | None) -> np.ndarray:
    """src: (h, w, 3) uint8. progress: 0-1 draw-in of the effect. caption: (words, index of the spoken word)."""
    h, w = src.shape[:2]
    target = (effect.x, effect.y) if effect and effect.type != "none" else (0.5, 0.5)
    x0, y0, cw, ch = crop_box(w, h, zoom, *target)
    img = Image.fromarray(src)
    if zoom > 1.001:
        img = img.resize((w, h), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch))

    def to_out(nx: float, ny: float) -> tuple[float, float]:
        return ((nx * w - x0) * w / cw, (ny * h - y0) * h / ch)

    if effect and effect.type != "none" and progress > 0:
        img = _draw_effect(img, effect, progress, to_out, zoom)
    if caption:
        _draw_caption(img, *caption)
    return np.asarray(img)


def _draw_effect(img: Image.Image, e: Effect, p: float, to_out, zoom: float) -> Image.Image:
    w, h = img.size
    color = COLORS[e.color]
    cx, cy = to_out(e.x, e.y)
    r = e.r * w * zoom
    stroke = max(4, int(min(w, h) * 0.011))

    if e.type == "spotlight":
        yy, xx = np.ogrid[:h, :w]
        dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        soft = np.clip((dist - r) / (r * 0.35 + 1), 0, 1)
        dim = 1 - 0.62 * ease(p) * soft
        arr = (np.asarray(img).astype(np.float32) * dim[..., None]).astype(np.uint8)
        img = Image.fromarray(arr)

    d = ImageDraw.Draw(img)
    if e.type in ("circle", "spotlight"):
        q = ease(p / 0.8)
        # slightly oval, starting top-left like a hand-drawn ring
        box = (cx - r * 1.08, cy - r, cx + r * 1.08, cy + r)
        if q >= 0.999:
            d.ellipse(box, outline=color, width=stroke)
        elif q > 0:
            d.arc(box, start=-120, end=-120 + 360 * q, fill=color, width=stroke)
        anchor = (cx, cy - r - stroke * 2)
    elif e.type == "arrow":
        fx = e.from_x if e.from_x is not None else min(0.95, max(0.05, e.x + (0.18 if e.x < 0.5 else -0.18)))
        fy = e.from_y if e.from_y is not None else min(0.95, max(0.05, e.y + (0.16 if e.y < 0.5 else -0.16)))
        tx, ty = to_out(fx, fy)
        # stop the head just short of the target so it doesn't cover it
        ang = math.atan2(cy - ty, cx - tx)
        hx, hy = cx - math.cos(ang) * r * 0.35, cy - math.sin(ang) * r * 0.35
        q = ease(p / 0.7)
        px, py = tx + (hx - tx) * q, ty + (hy - ty) * q
        d.line((tx, ty, px, py), fill=color, width=stroke)
        head = stroke * 4.5
        for side in (-1, 1):
            a = ang + math.pi + side * 0.5
            d.line((px, py, px + math.cos(a) * head, py + math.sin(a) * head), fill=color, width=stroke)
        d.ellipse((px - stroke / 2, py - stroke / 2, px + stroke / 2, py + stroke / 2), fill=color)
        anchor = (tx, ty - stroke * 3 if ty < cy else ty + stroke * 3)
    else:
        return img

    if e.label and p > 0.55:
        _draw_label(d, e.label, anchor, color, w, h)
    return img


def _draw_label(d: ImageDraw.ImageDraw, text: str, anchor: tuple[float, float], color, w: int, h: int) -> None:
    f = font(max(18, int(min(w, h) * 0.045)))
    text = text.upper()
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    tw, th = r - l, b - t
    pad = th * 0.35
    x = min(max(anchor[0] - tw / 2, pad), w - tw - pad)
    y = anchor[1] - th - pad * 2
    if y < pad:
        y = anchor[1] + pad * 2
    y = min(y, h - th - pad * 2)
    d.rounded_rectangle((x - pad, y - pad, x + tw + pad, y + th + pad), radius=pad, fill=color)
    d.text((x - l, y - t), text, font=f, fill=(15, 15, 15))


def _draw_caption(img: Image.Image, words: list[str], current: int) -> None:
    w, h = img.size
    d = ImageDraw.Draw(img)
    f = font(max(22, int(min(w, h) * 0.065)))
    stroke = max(3, f.size // 9)
    space = d.textlength(" ", font=f)
    widths = [d.textlength(word, font=f) for word in words]
    total = sum(widths) + space * (len(words) - 1)
    x = (w - total) / 2
    y = h * (0.80 if h > w else 0.84)
    for i, (word, ww) in enumerate(zip(words, widths)):
        fill = (255, 212, 0) if i == current else (255, 255, 255)
        d.text((x, y), word, font=f, fill=fill, stroke_width=stroke, stroke_fill=(0, 0, 0), anchor="ls")
        x += ww + space

"""Synthetic 10 s test clip: a ball rolls across a 'park', a small cat peeks out of a bush at 5 s, a beep at 7 s."""
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

W, H, FPS, SECS = 1280, 720, 30, 10
out = Path(sys.argv[1] if len(sys.argv) > 1 else "test_clip.mp4")
wav = out.with_suffix(".wav")

sr = 48000
t = np.arange(SECS * sr) / sr
audio = 0.04 * np.random.default_rng(1).normal(size=t.size)          # wind
beep = (t > 7) & (t < 7.3)
audio[beep] += 0.4 * np.sin(2 * np.pi * 880 * t[beep])
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "-", str(wav)],
               input=audio.astype("<f4").tobytes(), check=True)

enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                        "-r", str(FPS), "-i", "-", "-i", str(wav), "-c:v", "libx264", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-shortest", str(out)], stdin=subprocess.PIPE)
for i in range(SECS * FPS):
    s = i / FPS
    img = Image.new("RGB", (W, H), (135, 200, 245))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 470, W, H), fill=(80, 170, 70))                      # grass
    d.ellipse((900, 330, 1180, 520), fill=(40, 120, 40))                  # bush
    if s > 5:                                                             # cat peeks out
        up = min(1, (s - 5) / 0.6) * 60
        cx, cy = 1040, 360 - up
        d.ellipse((cx - 35, cy - 30, cx + 35, cy + 30), fill=(240, 150, 40))
        d.polygon([(cx - 30, cy - 15), (cx - 20, cy - 50), (cx - 5, cy - 25)], fill=(240, 150, 40))
        d.polygon([(cx + 30, cy - 15), (cx + 20, cy - 50), (cx + 5, cy - 25)], fill=(240, 150, 40))
        d.ellipse((cx - 17, cy - 8, cx - 7, cy + 2), fill=(0, 0, 0))
        d.ellipse((cx + 7, cy - 8, cx + 17, cy + 2), fill=(0, 0, 0))
    bx = 80 + s * 70                                                      # ball rolls right, stops by the bush
    bx = min(bx, 820)
    d.ellipse((bx - 40, 430, bx + 40, 510), fill=(220, 40, 40))
    enc.stdin.write(img.tobytes())
enc.stdin.close()
enc.wait()
wav.unlink()
print(out)

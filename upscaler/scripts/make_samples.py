"""Create small, degraded test media from the public-domain NASA 'astronaut' photo shipped with scikit-image.

samples/portrait_small.png  - 128x128, JPEG-compressed and slightly blurred
samples/clip_small.mp4      - 3 s, 320x240 @ 24 fps slow push-in on the same photo, with a tone on the audio track
"""
import subprocess
from pathlib import Path

import cv2
import numpy as np
from skimage import data

S = Path(__file__).resolve().parents[1] / "samples"
S.mkdir(exist_ok=True)

full = cv2.cvtColor(data.astronaut(), cv2.COLOR_RGB2BGR)  # 512x512
cv2.imwrite(str(S / "astronaut_512.png"), full)

small = cv2.resize(full, (128, 128), interpolation=cv2.INTER_AREA)
small = cv2.GaussianBlur(small, (0, 0), 0.6)
ok, jpg = cv2.imencode(".jpg", small, [cv2.IMWRITE_JPEG_QUALITY, 55])
cv2.imwrite(str(S / "portrait_small.png"), cv2.imdecode(jpg, cv2.IMREAD_COLOR))

subprocess.run([
    "ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", str(S / "astronaut_512.png"),
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100",
    "-filter_complex",
    "[0:v]scale=1024:1024,zoompan=z='1+0.004*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=72:s=320x240:fps=24,"
    "noise=alls=6:allf=t[v]",
    "-map", "[v]", "-map", "1:a", "-t", "3", "-c:v", "libx264", "-crf", "30", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-shortest", str(S / "clip_small.mp4"),
], check=True)
print("wrote", *sorted(p.name for p in S.iterdir() if p.is_file()))

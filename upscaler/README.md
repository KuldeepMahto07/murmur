# Clarion: local AI image and video upscaler

Clarion is an original app. Its feature set is modelled on the study in [saas/01-idea/competitor-analysis/topaz-analysis.md](saas/01-idea/competitor-analysis/topaz-analysis.md), and the approved stack is in [docs/plan.md](docs/plan.md). Everything runs on your own machine with open-source models.

## Run

```bat
upscaler\start.bat
```

Then open http://127.0.0.1:8001. On first run, `start.bat` builds the UI and downloads the model weights (~510 MB) into `upscaler/models/`.

To set it up from scratch:

```bat
cd upscaler
python -m venv backend\.venv
backend\.venv\Scripts\pip install torch==2.8.0 torchvision==0.23.0 --index-url https://download.pytorch.org/whl/cu128
backend\.venv\Scripts\pip install -r backend\requirements.txt
backend\.venv\Scripts\python scripts\download_models.py
```

`ffmpeg` and `ffprobe` must be on PATH.

## Features
- **Images**: 1× (enhance only), 2×, 4× or 8×; save as PNG, JPG or WebP; alpha is preserved.
- **Videos**: 2× or 4×, or a fixed 720p / 1080p / 1440p / 4K target. Frame-rate conversion (24–60 fps) or 2×/4× slow motion with motion-compensated interpolation. Output as H.264, H.265 10-bit or ProRes 422 HQ. The source audio is kept (it is dropped for slow motion).
- **Models**: Balanced (Real-ESRGAN general v3 with a noise-cleanup slider), Restore (x4plus), Illustration (anime 6B) and Lite 2× (x2plus). Every model offers an extra-crispness slider and an optional face recovery step (GFPGAN 1.4 + YuNet).
- **Preview**: render only the first N seconds of a clip, compare, then click **Render full video**.
- **Compare**: draggable wipe with Fit/100%/200% zoom for images; a synced wipe or side-by-side player for video.
- **Queue**: drop many files at once. A single GPU worker processes them with live progress and ETA, and you can cancel, re-run with new settings, download or remove each job.

## Verify

```bat
backend\.venv\Scripts\python scripts\make_samples.py
backend\.venv\Scripts\python scripts\e2e.py
```

## Licences of bundled models
Real-ESRGAN weights: BSD-3-Clause. GFPGAN v1.4: Apache-2.0. YuNet: Apache-2.0. spandrel: MIT.

## Business plan
The product is organised by the 16-stage SaaS lifecycle in [saas/](saas/README.md).

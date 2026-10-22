# Clarion: approved plan

Approved by the user on 2026-10-23. Clarion is an original local app that offers image and video AI upscaling. It is modelled on the feature set in `topaz-analysis.md`. It uses its own name, design and copy, and only open-source models.

## Stack (approved: "PyTorch + spandrel")
- **Backend**: Python 3.12, FastAPI + uvicorn, own venv at `upscaler/backend/.venv`.
- **Inference**: PyTorch (CUDA, fp16, tiled to fit the 4 GB GTX 1650 Ti; CPU fallback). Models are loaded through **spandrel** (MIT).
  - Real-ESRGAN x4plus, x2plus and x4plus-anime-6B, plus realesr-general-x4v3 and its `wdn` variant for the denoise knob (BSD-3).
  - GFPGAN v1.4 for faces (Apache-2.0), with OpenCV's YuNet face detector (Apache-2.0) and paste-back.
- **Video**: ffmpeg (already installed). It decodes frames to a pipe, then the frames are upscaled in batches and piped into the encoder. Audio is stream-copied. Frame interpolation and slow motion use the ffmpeg `minterpolate` filter (MCI); RIFE is a later upgrade.
- **Front end**: React + Vite, built into `upscaler/frontend/dist` and served by FastAPI.
- **Target** (approved: "Local web app"): `upscaler/start.bat` serves http://127.0.0.1:8001, so it does not clash with Murmur on :8000.

## MVP scope (approved: "Core + faces + interp")
| Feature | Clarion implementation |
|---|---|
| Image upscale 1×/2×/4× (8× = 4× twice) | Real-ESRGAN family |
| Video upscale to ×2/×4 or a 1080p / 4K target | per-frame upscale + Lanczos resize to the exact target |
| Model presets | **Balanced** (general x4v3), **Clean-up** (x4plus, heavy compression/noise), **Illustration** (anime-6B), **Lite** (x2plus) |
| Denoise slider | general-x4v3 / wdn weight interpolation |
| Sharpen slider | unsharp mask after upscale |
| Face recovery toggle | GFPGAN on detected faces |
| Video preview | process the first N seconds only, then compare |
| Frame-rate target / slow motion | `minterpolate` to 24/30/60 fps, or ×2/×4 slow-mo |
| Output formats | image PNG/JPG/WebP; video H.264 (mp4), H.265 10-bit (mp4), ProRes 422 HQ (mov) |
| Before/after | drag slider for images; synced two-video wipe for video |
| Batch queue | multi-file drop, a single GPU worker, live progress polling |

Out of scope: diffusion/creative models (they need >4 GB VRAM), SDR→HDR, stabilization, accounts and billing.

## Verification (2026-10-23, GTX 1650 Ti 4 GB, CUDA)
`scripts/e2e.py` was run against the live server and printed **ALL OK**. The log is in `samples/out/e2e.log`.
- Image 128×128 → 512×512 at 4× with Balanced and face recovery: 3.2 s. Restore, Illustration and Lite at 2× (JPG output): 1–2 s each.
- Video, 320×240 at 24 fps, 3 s, with AAC audio:
  - 2 s preview at 1080p H.264: 1440×1080, 48 frames, audio kept, 17 s.
  - Full run at 2× with 2× slow motion and faces, H.265 10-bit: 640×480, 141 frames, yuv420p10le, 72 s.
  - Full run at 4× with Illustration, 60 fps interpolation, ProRes 422 HQ: 1280×960, 176 frames, 60 fps, PCM audio, 63 s.
- UI checked in the browser at 1440×900:
  - Drag-and-drop upload honours the settings panel (faces on; 1080p preview).
  - The image wipe and zoom work, and the video wipe stays in sync (both players at the same time).
  - The wipe handle drags (50% → 81%), and "Render full video" appears after a preview.

## Gotchas found while building
- RRDB models (x4plus, anime-6B) give NaNs in fp16 on GTX 16xx cards. The engine detects this and switches that model to fp32 automatically.
- spandrel's GFPGAN does no normalisation, so the input and output must be in [-1, 1] (handled in `faces.py`).
- YuNet misses faces under about 40 px, so detection runs on a copy resized to a 640 px long side.
- Throughput is about 3 fps at 1080p for Balanced. 8× and 4K targets from large sources take a second model pass and are much slower.
- The C: drive is nearly full. The torch install used `TEMP=D:\tmp\pip`.

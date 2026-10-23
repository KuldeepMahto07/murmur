# Backend

**Code lives in:** `upscaler/backend/app/`
- `engine.py`: spandrel model loading, denoise weight blending, tiled fp16 inference with OOM back-off and automatic fp32 fallback, multi-pass scaling, unsharp mask
- `faces.py`: YuNet detection, 5-point alignment to a 512 template, GFPGAN in [-1, 1], oval feathered paste-back
- `video.py`: ffprobe, size targets, ffmpeg decode → frames → encode pipes, minterpolate, codecs, comparison proxies
- `jobs.py`: in-process queue, single GPU worker thread, job JSON persistence, cancel/delete
- `models_registry.py`: weight URLs, licences and presets
- `main.py`: FastAPI app and static UI

**Missing:** a multi-GPU or multi-worker design, resume after a crash (interrupted jobs are marked as errors), and per-user isolation.

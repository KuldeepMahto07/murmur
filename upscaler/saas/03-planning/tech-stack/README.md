# Tech stack

| Layer | Choice | Why |
|---|---|---|
| Inference | PyTorch 2.8 CUDA + spandrel | Loads Real-ESRGAN/GFPGAN weights without basicsr; fp16 with automatic fp32 fallback |
| Models | Real-ESRGAN general-v3 (+wdn), x4plus, x2plus, anime-6B; GFPGAN 1.4; YuNet | BSD-3 / Apache-2.0 licences allow commercial use |
| Video | ffmpeg rawvideo pipes; minterpolate; libx264/libx265/prores_ks | Any container in, pro codecs out |
| API | FastAPI + one in-process GPU worker thread | One GPU = one job at a time |
| UI | React 18 + Vite | Same as Murmur |
| Storage | `upscaler/data/jobs/<id>/job.json` + files | No database needed locally |

**Cloud additions:** Postgres (users, jobs, credits ledger), Cloudflare R2 or S3 (media), a Redis/SQS queue, and GPU workers on RunPod/Modal or AWS g6 (L4). See [cloud hosting](../../06-infrastructure/cloud-hosting/README.md).

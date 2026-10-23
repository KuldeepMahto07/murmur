# APIs

**Code lives in:** `upscaler/backend/app/main.py`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/system` | GPU name, VRAM, fp16 |
| GET | `/api/options` | presets, scales, targets, codecs, fps, defaults |
| POST | `/api/jobs` | multipart `file` + `settings` JSON → job |
| POST | `/api/jobs/{id}/rerun` | same source, new settings |
| GET | `/api/jobs`, `/api/jobs/{id}` | list / status (progress, message, result, urls) |
| POST | `/api/jobs/{id}/cancel` | cancel |
| DELETE | `/api/jobs/{id}` | delete job and files |
| GET | `/api/jobs/{id}/files/{name}?download=true` | source/before/after/output |

**Missing:** API keys, rate limits, webhooks on completion, OpenAPI docs published for customers (FastAPI already serves `/docs` locally), and resumable chunked uploads for large files.

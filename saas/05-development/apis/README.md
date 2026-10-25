# APIs → [`backend/app/main.py`](../../../backend/app/main.py)

**Status: Done (MVP).** Part of [05 · Development](../README.md) in the [Murmur SaaS plan](../../README.md).

| Method & path | Purpose |
|---|---|
| `GET /api/config` | Languages, modes, diarization method, export formats |
| `POST /api/jobs` (multipart) | Upload files + options → jobs |
| `POST /api/jobs/url` | Import from link |
| `GET /api/jobs`, `GET /api/jobs/{id}` | List / get job (status, stage, progress, speakers, translations) |
| `PATCH /api/jobs/{id}` | Rename title, speaker names |
| `POST /api/jobs/{id}/retry`, `DELETE /api/jobs/{id}`, `POST /api/jobs/bulk-delete` | Lifecycle |
| `GET/PUT /api/jobs/{id}/transcript[?lang=]` | Read / edit segments (text, speaker) |
| `GET /api/jobs/{id}/media` | Original media (the player can seek in it) |
| `POST /api/jobs/{id}/translate`, `GET /api/translate/languages` | Offline translation |
| `GET /api/jobs/{id}/export?format=&timestamps=&speakers=&lang=`, `POST /api/export/bulk` | Downloads / ZIP |

Interactive docs: http://127.0.0.1:8000/docs (FastAPI).
**Missing:** API versioning (`/api/v1`), auth tokens for a public API, webhooks on job completion, and a published OpenAPI file for integrators.

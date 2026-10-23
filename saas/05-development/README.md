# 05 · Development

**Status: in progress.** The MVP is complete and verified end to end, and authentication is not built. **The code stays where it is** at the repo root; moving it would break `start.bat`, the build and the Vercel deployment. Each subfolder here points to the code.

| Area | Code | State |
|---|---|---|
| [Frontend](frontend/) | `frontend/src/` | ✅ MVP |
| [Backend](backend/) | `backend/app/` | ✅ MVP |
| [APIs](apis/) | `backend/app/main.py` | ✅ MVP |
| [Database](database/) | `backend/app/db.py` | ✅ MVP (SQLite) |
| [Authentication](authentication/) | — | ❌ Not built (single-user by design) |
| [Integrations](integrations/) | `worker.py`, `translate.py`, `diarize.py` | ✅ yt-dlp, Argos, pyannote/ECAPA |

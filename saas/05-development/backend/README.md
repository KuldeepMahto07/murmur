# Backend → `backend/app/`

| File | What it does |
|---|---|
| [`config.py`](../../../backend/app/config.py) | Paths, env (`HF_TOKEN`, `MURMUR_DEVICE`, `MURMUR_CORS_ORIGINS`, upload cap), modes, language list |
| [`worker.py`](../../../backend/app/worker.py) | Single background job loop: download (yt-dlp) → prepare → transcribe → diarize → save |
| [`pipeline.py`](../../../backend/app/pipeline.py) | ffmpeg to 16 kHz WAV (+ optional denoise), faster-whisper, word-to-speaker assignment, flicker merge |
| [`diarize.py`](../../../backend/app/diarize.py) | pyannote 3.1 or ECAPA embeddings + clustering (auto count via silhouette) |
| [`exports.py`](../../../backend/app/exports.py) | TXT/SRT/VTT/CSV/JSON/DOCX/PDF, subtitle cue splitting |
| [`translate.py`](../../../backend/app/translate.py) | Argos Translate, English pivot, on-demand model install |

**Run:** `start.bat`, or `backend/.venv/Scripts/python -m uvicorn app.main:app --app-dir backend`.
**Missing:** job cancellation, parallel CPU jobs, a structured logging/metrics endpoint, and a settings API (HF token from the UI).

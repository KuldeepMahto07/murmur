# Database → [`backend/app/db.py`](../../../backend/app/db.py)

- **SQLite** at `data/murmur.db` via SQLModel. One table, `Job`: id, title, source, status/stage/progress/error, options (language, mode, diarize, speakers, to-English, clean audio), detected language, duration, speaker names (JSON), timestamps.
- **Transcripts are JSON files**, not rows: `data/jobs/<id>/transcript.json` (+ `transcript.<lang>.json` for translations). Each segment has id, start, end, text, speaker, words[], edited.
- **Media** lives in `data/jobs/<id>/source.<ext>`. The 16 kHz WAV is deleted after processing.
- On startup, `running` jobs are reset to `queued` (crash recovery).

**Missing:** schema migrations (Alembic) before any column change ships to users, full-text search across all transcripts (SQLite FTS5), and storage-usage reporting and cleanup.

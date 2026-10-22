# Murmur

A local transcription app: drop in audio or video (or paste a link) and get a timed, speaker-labelled transcript you can search, edit, translate and export. Everything runs on your machine.

- `docs/turboscribe-analysis.md`: notes on the product this app takes its feature set from
- `docs/plan.md`: the approved stack and MVP scope

## Features
- Upload several files at once (any format ffmpeg reads), or import from a URL (YouTube and more) with yt-dlp
- Language auto-detect or a choice of about 99 Whisper languages. Three quality modes: Swift (`base`), Steady (`small`), Precise (`large-v3-turbo`)
- Speaker labels: pyannote 3.1 when `HF_TOKEN` is set, otherwise the built-in ECAPA embedding clustering. Fixed or automatic speaker count
- "Output in English" (Whisper translate task) and a noise clean-up filter
- Library with live progress, retry, delete, bulk ZIP export and bulk delete
- Transcript view: synced player with speed control, click to seek, follow playback, search with highlights, timestamps toggle, inline text editing, per-passage speaker reassignment, speaker renaming
- Export to TXT, DOCX, PDF, SRT, VTT, CSV and JSON, with or without timestamps and speaker names
- Offline translation of finished transcripts with Argos Translate

## Setup (Windows)
Requires Python 3.12, Node 18+ and ffmpeg on PATH. An NVIDIA GPU is optional; without one it falls back to CPU.

```bash
python -m venv backend/.venv
```
```bash
backend/.venv/Scripts/pip install torch==2.8.0 torchaudio==2.8.0 --index-url https://download.pytorch.org/whl/cu128
```
```bash
backend/.venv/Scripts/pip install -r backend/requirements.txt
```
```bash
cd frontend && npm install && npm run build
```

Optional: copy `.env.example` to `.env` and set `HF_TOKEN` to use pyannote for speaker labels.

## Run
```bash
start.bat
```
Then open http://127.0.0.1:8000. Models download into `data/models` the first time each one is used.

For front-end development, run `npm run dev` in `frontend/`. It serves on :5173 and proxies `/api` to :8000.

## Test
```bash
powershell -ExecutionPolicy Bypass -File scripts/make_sample.ps1
```
```bash
backend/.venv/Scripts/python scripts/e2e.py
```
`make_sample.ps1` writes a two-voice text-to-speech clip to `samples/`. `e2e.py` uploads it to the running server, waits for the transcript, and checks every export format.

## Layout
```
backend/app/
  main.py       FastAPI routes and the static SPA
  worker.py     background job queue (one job at a time)
  pipeline.py   ffmpeg prep, faster-whisper, word-to-speaker assignment
  diarize.py    pyannote, or ECAPA + agglomerative clustering
  exports.py    TXT/SRT/VTT/CSV/JSON/DOCX/PDF
  translate.py  Argos Translate
frontend/src/   React UI (upload, library, transcript)
data/           SQLite database, uploaded media, transcripts, models
```

## Known limits
- One job runs at a time. That suits a single 4 GB GPU.
- PDF export uses Arial, so scripts Arial lacks (CJK, Devanagari and others) won't render in PDFs. Use DOCX or TXT for those.
- ECAPA speaker labels are fine for clean, turn-taking speech and weaker on crosstalk. pyannote is better.
- No accounts, quotas or billing. It is single-user and listens only on localhost.

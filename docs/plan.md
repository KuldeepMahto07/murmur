# Proposed stack and MVP — "Murmur" (working name)

An original, local-first transcription app with the feature set described in `turboscribe-analysis.md`. It has its own name, design and copy.

## Machine constraints
Windows 11, Python 3.12, Node 24, ffmpeg 8 on PATH, GTX 1650 Ti (4 GB VRAM), 53 GB free on D:.
4 GB of VRAM fits faster-whisper `large-v3` in int8 or `large-v3-turbo`. On CPU, `small` is the practical upper limit.

## Stack
| Layer | Choice | Why |
|---|---|---|
| API and server | **FastAPI** + Uvicorn | Async, file uploads, serves the SPA too |
| Storage | **SQLite** (SQLModel) + files on disk under `data/` | No services to install |
| Jobs | In-process worker thread over a SQLite-backed queue, one GPU job at a time | No Redis or Celery to set up on Windows. Can be swapped later |
| ASR | **faster-whisper** (CTranslate2), CUDA with int8_float16, CPU fallback | Fastest open Whisper. Word timestamps, VAD, translate task |
| Modes | Fast = `base`, Balanced = `small`, Accurate = `large-v3-turbo` | Mirrors the three-tier speed/accuracy choice |
| Speakers | **pyannote/speaker-diarization-3.1**, words assigned to speakers by time overlap (the whisperX approach) | Needs a free Hugging Face token and one-time acceptance of the model's terms |
| Denoise | ffmpeg `afftdn` + `highpass`/`lowpass` filters | No extra model |
| URL import | **yt-dlp** | YouTube and most media sites |
| Translation | **argos-translate** (offline) | Free and local. Quality is below DeepL or Google |
| Exports | TXT, SRT, VTT, CSV, JSON (stdlib), DOCX (python-docx), PDF (reportlab) | |
| Front end | **React + Vite + TypeScript**, plain CSS | Transcript editor needs real client state |

## MVP scope
1. Upload page: drag and drop several files, or paste a URL. Options: language (auto plus about 99 Whisper languages), mode, speakers (on/off, count or auto), translate to English, clean up audio.
2. Library: job list with live status and progress. Rename, delete, bulk export as ZIP.
3. Transcript page: media player synced to the text, click a segment to seek, active-segment highlight, timestamps toggle, rename speakers, edit segment text, search.
4. Export dialog: all six formats plus JSON, with include-timestamps and include-speakers options.
5. Translate a finished transcript into a target language and download it.
6. Single user, no accounts or billing.

Out of the MVP: accounts and quotas, payments, AI summaries (could be added later with a local LLM or the Claude API).

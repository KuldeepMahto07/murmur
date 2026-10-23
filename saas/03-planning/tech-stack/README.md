# Tech stack

| Layer | Choice | Why / notes |
|---|---|---|
| ASR | faster-whisper 1.2 (CTranslate2), `base` / `small` / `large-v3-turbo` | Fastest open Whisper. int8_float16 on CUDA fits 4 GB GPUs |
| Speakers | pyannote 3.1 (with HF token) → fallback SpeechBrain ECAPA + agglomerative clustering | Works out of the box, better with a token |
| Translation | Argos Translate (offline) | Free and local. Quality is basic (e.g. "strings" → "cuerdas") |
| URL import | yt-dlp | Broad site support |
| Backend | FastAPI, SQLModel/SQLite, one background worker thread | Zero external services on Windows |
| Exports | python-docx, reportlab, stdlib | |
| Frontend | React 18 + Vite + TypeScript, hand-written CSS | Demo mode when no server is reachable |
| Hosting | Local (start.bat) + Vercel static demo | |

**Pinned:** torch/torchaudio **2.8.0** (cu128). speechbrain needs ≥ 2.7.1, and pyannote 3.3 breaks on torchaudio ≥ 2.9. Audio is decoded with ffmpeg and passed to Whisper as numpy, which avoids a faster-whisper/PyAV incompatibility.

**Decisions to make for v0.2:** installer tech (PyInstaller + Inno Setup vs. a Tauri shell around the web UI). Recommendation: a Tauri shell plus a bundled Python sidecar.

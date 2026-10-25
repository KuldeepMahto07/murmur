# Integrations

**Status: In progress: pyannote built but not verified.** Part of [05 · Development](../README.md) in the [Murmur SaaS plan](../../README.md).

| Integration | Code | State |
|---|---|---|
| yt-dlp (link import) | [`worker.py`](../../../backend/app/worker.py) `_download_url` | ✅ Verified with a public FLAC |
| Argos Translate | [`translate.py`](../../../backend/app/translate.py) | ✅ Verified en→es |
| pyannote (Hugging Face) | [`diarize.py`](../../../backend/app/diarize.py) | ⚠️ Built, not verified (needs `HF_TOKEN`) |
| SpeechBrain ECAPA | [`diarize.py`](../../../backend/app/diarize.py) | ✅ Verified |
| Hugging Face model hub (Whisper weights) | [`pipeline.py`](../../../backend/app/pipeline.py) | ✅ Cached in `data/models` |

**Planned:** Ollama (local summaries), NVivo/ATLAS.ti export presets, Zotero attachment (for researchers), and a watch folder (Dropbox/OneDrive synced folder, processed locally).

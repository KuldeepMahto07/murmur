# Bug fixing (log)

| Date | Bug | Fix |
|---|---|---|
| 2026-10-22 | 500 on upload: job fields expired after commit | `s.refresh()` after commit in `create_jobs` |
| 2026-10-22 | faster-whisper `av.open(metadata_errors=…)` TypeError with newer PyAV | Pass decoded numpy samples instead of a path |
| 2026-10-22 | Turn-initial words ("Thanks.", "Perfect.") attached to the previous speaker | Fold one-word blips only when both neighbours share a speaker |
| 2026-10-22 | torch silently upgraded to a CPU build by speechbrain's dependency resolution | Pin torch/torchaudio 2.8.0 cu128 |
| 2026-10-22 | Speaker dropdown changed only the first passage of a turn | Reassign every passage in the turn |

**Known open issues:**
- PDF export can't render scripts missing from Arial (CJK, Devanagari).
- Argos translation quality (domain words).
- No progress shown during the first model download.
- Harmless `ConnectionResetError` noise from asyncio on Windows in the server log.

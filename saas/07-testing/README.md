# 07 · Testing

**Status: in progress.** A solid end-to-end script and manual UI checks exist. There's no saved unit-test suite, no CI, no long-file performance data and no external beta.

| Sub-item | Built | Missing |
|---|---|---|
| [Unit testing](unit-testing/) | Ad-hoc exporter smoke test (not saved) | pytest suite for exports, speaker assignment and routes; Vitest for the UI helpers |
| [Integration testing](integration-testing/) | `scripts/e2e.py` + TTS sample; Steady, Precise, URL import and translation verified | pyannote, real-world recordings, WER fixtures, CPU mode |
| [Bug fixing](bug-fixing/) | Log of 5 fixed bugs | 4 known open issues |
| [Performance testing](performance-testing/) | 42 s clip: Steady 14 s, Precise 6 s on a GTX 1650 Ti | 1–3 h files, CPU numbers, large-library UI |
| [Beta testing](beta-testing/) | — | 30-person protocol and exit criteria (written, not run) |

**Next action:** save the exporter and speaker-assignment tests as `backend/tests/` (pytest), the cheapest safety net.

# Integration testing

**Built:** [`scripts/e2e.py`](../../../scripts/e2e.py) uploads a file to a running server, waits, prints segments, checks all 7 exports and the bulk ZIP. [`scripts/make_sample.ps1`](../../../scripts/make_sample.ps1) generates a 42 s two-voice TTS clip.

**Verified runs (2026-10-22):**
| Path | Result |
|---|---|
| Steady + ECAPA auto speakers | ✅ 2 speakers, 7/7 turns correct, all exports |
| Precise (large-v3-turbo) | ✅ 6 s for 42 s audio cached; about 1.9 GB VRAM |
| URL import (yt-dlp, JFK FLAC) | ✅ exact transcript |
| Translation en→es + translated export | ✅ |
| pyannote | ❌ not run (no token) |

**Missing:** real-world recordings (crosstalk, accents, phone audio, 60+ min files), a non-English source file, a video file, CPU-only mode, and a fixture set with reference transcripts to compute word error rate (WER) per mode.

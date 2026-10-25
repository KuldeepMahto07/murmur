# Performance testing

**Status: Partial: 42 s clip measured; 1 h and 3 h files to do.** Part of [07 · Testing](../README.md) in the [Murmur SaaS plan](../../README.md).

**Measured (GTX 1650 Ti 4 GB, cached models):**
| Mode | Clip | Wall time | Real-time factor |
|---|---|---|---|
| Steady (`small`) + ECAPA | 42 s | 14 s total job | about 0.33 |
| Precise (`large-v3-turbo`) + ECAPA | 42 s | 6 s total job | about 0.14 |

(Turbo is faster than `small` here because it has only 4 decoder layers.)

**To do:**
- 1 h and 3 h files per mode: time, peak VRAM, RAM, and the diarization share of the total.
- CPU-only numbers on a typical laptop (the deciding factor for non-GPU buyers).
- Library page with 1,000 jobs (polling cost), and a transcript page with 3,000 segments (render and scroll; consider virtualisation).

# Feature prioritization

**Status: Done.** Part of [03 · Planning](../README.md) in the [Clarion SaaS plan](../../README.md).

RICE scoring: Reach (users per quarter), Impact (1-3), Confidence, Effort (person-weeks). Score = R x I x C / E.

| Feature | R | I | C | E | Score |
|---|---|---|---|---|---|
| Social presets | 800 | 2 | 0.9 | 0.5 | **2880** |
| Deinterlace preset | 200 | 2 | 0.9 | 0.5 | 720 |
| Desktop installer | 1000 | 2 | 0.8 | 3 | 533 |
| RIFE interpolation | 500 | 2 | 0.7 | 1.5 | 467 |
| TensorRT speed-up | 1500 | 1 | 0.6 | 2 | 450 |
| Cloud rendering | 1500 | 3 | 0.6 | 8 | 338 |
| Diffusion upscale | 400 | 3 | 0.4 | 8 | 60 |

**Build order:** social presets, deinterlace, installer, RIFE, TensorRT, cloud. The cloud ranks lower on RICE but gates revenue, so start it once validation passes.

# MVP scope

**Status: Done.** Part of [03 · Planning](../README.md) in the [Clarion SaaS plan](../../README.md).

The approved MVP is defined in [`upscaler/docs/plan.md`](../../../docs/plan.md). It is **complete and verified**: `scripts/e2e.py` printed ALL OK, and a real 720x1280 → 2160x3840 60 fps render succeeded (899 frames in 56 min).

**In scope (done):** image 1/2/4/8x; video 2/4x or 720p-4K targets; 4 presets; denoise and sharpen sliders; GFPGAN faces; preview segment; minterpolate fps change and slow-mo; H.264, H.265 10-bit and ProRes output; image and video wipe compare; batch queue.

**Out of scope:** accounts, billing, cloud, diffusion models, SDR→HDR, stabilisation.

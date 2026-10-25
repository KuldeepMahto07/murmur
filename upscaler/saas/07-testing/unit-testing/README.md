# Unit testing

**Status: Not started (plan written).** Part of [07 · Testing](../README.md) in the [Clarion SaaS plan](../../README.md).

**Today:** none (only the end-to-end script).

**Add pytest for:**
- `video.output_size`: targets, even dimensions, portrait vs landscape (720x1280 → 4K = 2160x3840)
- `video._interp_filter`: fps up/down, slow-mo
- `engine.upscale_bgr` pass count: 1x = 1 pass, 1440-wide from 320 = 1 pass, 8x = 2 passes. This is the regression that once cost 16x speed.
- `_run` fp32 fallback on NaN, using a mocked model
- `main._clean` validation

# Integration testing

**Status: Done.** Part of [07 · Testing](../README.md) in the [Clarion SaaS plan](../../README.md).

**Built:** `upscaler/scripts/e2e.py` (with `scripts/make_samples.py`) drives the real HTTP API and checks output dimensions, codec, pixel format, frame count, fps and audio. It covers:
- an image at 4x with faces, and all four presets at 2x
- a 1080p H.264 video preview
- a full 2x run with 2x slow motion to H.265 10-bit
- a full 4x run with Illustration at 60 fps to ProRes

**Result:** ALL OK (log at `samples/out/e2e.log`).

**Missing:** UI tests (Playwright: drop file → wipe compare), alpha-PNG and TIFF inputs, and portrait/rotated video.

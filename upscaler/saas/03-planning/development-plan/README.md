# Development plan

**Status: Done.** Part of [03 · Planning](../README.md) in the [Clarion SaaS plan](../../README.md).

Sprints are 1 week each, for a solo developer.

1. **Social presets + deinterlace.** Add a preset map (Reel 4K60, TikTok 1080p60, YouTube 4K30, VHS restore = `bwdif` + Restore model) and UI chips.
2. **ETA + notifications.** Use a rolling-average fps, and fire a browser `Notification` when a job finishes.
3. **RIFE.** Vendor the Practical-RIFE architecture (MIT), interpolate source frames before upscaling, and keep minterpolate as a CPU fallback.
4. **Installer.** Tauri shell + embedded Python (or PyInstaller), with a first-run model download (`scripts/download_models.py`).
5-6. **Speed.** Batch 2-4 frames per forward pass, ONNX → TensorRT fp16, NVENC encode (`h264_nvenc` / `hevc_nvenc`).
7-10. **Cloud beta.** Auth, uploads, queue, workers, credits and Stripe (stages 05, 06, 11 and 12).

**Done means:** `scripts/e2e.py` passes, plus a new test for the feature.

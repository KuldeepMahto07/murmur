# Performance testing

**Measured on a GTX 1650 Ti (4 GB, fp16), Balanced preset**
- About **4.0 GPU-seconds per input megapixel per frame**, including the 4x pass, the resize and the H.264 encode. This held both for 320x240 → 1440x1080 (0.31 s/frame) and for 720x1280 → 2160x3840 (3.72 s/frame).
- Real job: 15 s 720x1280 30 fps → 4K 60 fps took 899 frames in 3347 s (0.27 fps).
- Faces add about 2 s per frame when a face is present. RRDB presets (Restore, Illustration) run in fp32 on this card, about 2-3x slower.

**To do**
- Benchmark on an L4, A10G and RTX 4090 to replace the assumed speed-ups in the pricing table.
- Profile the CPU side (frame copies, `cv2.resize`).
- Try NVENC encoding.

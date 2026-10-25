# Bug fixing

**Status: Ongoing.** Part of [07 · Testing](../README.md) in the [Clarion SaaS plan](../../README.md).

**Fixed during the build**

| Bug | Fix |
|---|---|
| fp16 NaNs on GTX 16xx for RRDB models (x4plus, anime) | Detect non-finite output, then switch that model to fp32 |
| GFPGAN output wrong (spandrel doesn't normalise) | Feed [-1, 1] and map back |
| Rectangular halo around restored faces | Feathered oval mask |
| YuNet missed faces under ~40 px | Detect on a copy with a 640 px long side |
| 1440-wide target ran a second 4x pass (287 s → 17 s after the fix) | Repeat a pass only when more than 1.5x is still missing |
| Blank first frame in the video wipe | `#t=0.001` on the video src |
| Inference-tensor in-place clamp error on the fp32 path | Use non-in-place `clamp` |

**Open**
- The queue shows duplicate names with no distinguishing info.
- The server dies with the session that launched it; the docs should recommend `start.bat`.
- 8x and 4K from large sources is very slow; tune tile size.

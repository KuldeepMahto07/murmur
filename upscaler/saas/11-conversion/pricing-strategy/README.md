# Pricing strategy and GPU cost per minute

**Status: Draft: modelled from measured GPU cost; not validated.** Part of [11 · Conversion](../README.md) in the [Clarion SaaS plan](../../README.md).

### 1. Measured cost basis
On our GTX 1650 Ti (fp16, Balanced preset) the full pipeline (4x pass + resize + H.264 encode) costs about **4.0 GPU-seconds per input megapixel per output frame**. It was measured twice:
- 320x240 → 1440x1080: 0.31 s/frame
- 720x1280 → 2160x3840 60 fps: 899 frames in 3347 s (3.72 s/frame)

Frame interpolation happens *before* upscaling, so every output frame gets upscaled. 60 fps therefore costs 2x as much as 30 fps.

**Formula**
`GPU-seconds (1650 Ti) = output_fps x 60 x input_MP x 4.0` per output minute.
`Cost = GPU-seconds / speedup x price_per_hour / 3600`.

### 2. GPU assumptions
These are **estimates; benchmark before going live** (see [performance testing](../../07-testing/performance-testing/README.md)).

| GPU | On-demand $/h (approx.) | Assumed speed-up vs 1650 Ti | $ per 1650-Ti-second |
|---|---|---|---|
| NVIDIA T4 (AWS g4dn.xlarge) | 0.53 | 2.5x | 0.0000589 |
| NVIDIA L4 (AWS g6.xlarge) | 0.80 | 5x | 0.0000444 |
| NVIDIA A10G (AWS g5.xlarge) | 1.01 | 6x | 0.0000468 |
| RTX 4090 (RunPod/Vast community) | 0.50 | 15x | 0.0000093 |

### 3. GPU cost per output minute, 30 fps, Balanced, no faces

| Source | Input MP | 1650 Ti GPU-s | T4 | L4 | A10G | RTX 4090 |
|---|---|---|---|---|---|---|
| 480p (854x480) | 0.41 | 2,952 | $0.17 | $0.13 | $0.14 | $0.027 |
| 720p (1280x720) | 0.92 | 6,624 | $0.39 | $0.29 | $0.31 | $0.061 |
| 1080p (1920x1080) | 2.07 | 14,904 | $0.88 | $0.66 | $0.70 | $0.14 |

Multipliers:
- **60 fps:** 2x
- **Faces:** about 1.5x when faces are present
- **Restore/Illustration (RRDB):** about 2.5x
- **TensorRT fp16:** expected 0.4-0.5x (to be measured)

### 4. Credit design
**1 credit = 1 output minute at 30 fps from a source of up to 0.5 MP (480p-class).**

Credits per minute = `ceil(input_MP / 0.5) x (fps / 30) x model factor`, where the model factor is 1 for Balanced/Lite, 2 for Restore/Illustration, and +0.5 with faces.

| Example | Credits/min |
|---|---|
| Phone 720x1280 → 4K at 60 fps | 2 x 2 = **4** |
| 1080p → 4K at 30 fps | **5** |

**Images:** a 1 MP image at 4x is about 4 GPU-s on the 1650 Ti, or about $0.0002 on an L4. Images are effectively free, so they're unlimited on paid plans (fair use: 2,000 a month) and the free tier allows 20 a day.

### 5. Price points and margins
Margins are at L4 / RTX 4090 cost, using $0.13 / $0.027 per credit.

| Plan | Price | Credits | $/credit | Gross margin (L4 / 4090) |
|---|---|---|---|---|
| Pay-as-you-go | $5 for 20 | 20 | $0.25 | 48% / 89% |
| Creator | $12/mo | 60 | $0.20 | 35% / 87% |
| Pro | $29/mo | 200 | $0.145 | 10% / 81% |
| Annual Pro | $290/yr | 2,400 | $0.12 | -8% / 78% |

**Decision:** sell Creator and Pro only if workers run on RTX 4090-class GPUs, or on L4 with TensorRT (cost per credit at or below $0.07). Otherwise launch with pay-as-you-go plus Creator only. Unused credits don't roll over; breakage usually lifts the real margin.

**Anchors:** Topaz Video is $59/mo desktop and Topaz Studio is $69/mo with 300 video credits; cloud-credit packs run $9.99 for 80 (observed). Clarion's pitch is "free locally; pay only when you borrow our GPU".

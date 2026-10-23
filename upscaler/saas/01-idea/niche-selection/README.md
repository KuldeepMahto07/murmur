# Niche selection

Candidates scored 1-5 (higher is better):

| Niche | Pain | Can pay | Reachable | We can win | Total |
|---|---|---|---|---|---|
| **Short-form creators: "make my clip 4K60"** | 4 | 3 | 5 (TikTok/IG/YT) | 4 (simple UX, cheap) | **16** |
| GenAI video upscaling | 4 | 4 | 4 | 2 (Topaz Starlight/Astra are diffusion-grade; we only have GAN models on 4 GB) | 14 |
| Old family video restoration | 5 | 3 | 3 | 3 (needs deinterlacing and denoise) | 14 |
| Photo print enlargement | 3 | 4 | 3 | 3 | 13 |
| E-commerce batch images | 3 | 4 | 3 | 3 (needs an API) | 13 |

**Pick:** short-form creators first, with images as a free hook and old-family-video restoration as the second niche once deinterlacing ships.

Why: it fits the real request we already served (720x1280 gym clip → 4K60), GAN models are good enough for it, and short clips keep GPU cost per job low (see [pricing strategy](../../11-conversion/pricing-strategy/README.md)).

Naming risk: "Clarion" is also an established car-audio brand. Run a trademark search (Nice classes 9 and 42) before launch.

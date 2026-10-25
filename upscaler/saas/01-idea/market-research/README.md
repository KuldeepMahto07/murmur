# Market research

**Status: Done.** Part of [01 · Idea](../README.md) in the [Clarion SaaS plan](../../README.md).

**Segments and why they pay**

| Segment | Typical input | Willingness to pay | Notes |
|---|---|---|---|
| Social creators (TikTok/IG/YT Shorts) | 720p-1080p phone clips, re-downloads | Low-mid ($5-15/mo) | Want a fast "make it crisp" button and a 60 fps option |
| GenAI video creators (Sora/Veo/Kling/Midjourney video) | 720p/1080p AI clips, 5-10 s | Mid ($15-30/mo) | Topaz has a landing page for each of these models, which signals demand |
| Photographers / print | JPG/RAW crops, old scans | Mid-high | Need 4-8x scaling, faces, fidelity |
| E-commerce sellers | Product photos | Mid; volume | Batch processing, API |
| Archivists / families | VHS/DV/8 mm transfers | One-off purchases | Deinterlacing and denoise matter more than resolution |

**Market signals**
- Topaz says it has 3M+ users (marketing site). Free open-source desktop tools (Upscayl, Video2X) have large GitHub followings, so there is broad consumer demand plus price sensitivity.
- Cloud rendering is a credits business: Topaz sells packs from 80 credits for $9.99 up to 20,000 for $999.99 a month (observed in their public `/api/products` response).

**Sizing approach (to do; don't guess):**
1. Pull monthly search volume for "video upscaler", "upscale video to 4k", "ai photo enhancer", "image upscaler" and "60fps converter" from a keyword tool. Bottom-up: searches x CTR x conversion x ARPU.
2. Use Upscayl/Video2X GitHub stars and release-download counts as a proxy for the local, privacy-minded segment.

**Positioning gap:** "free local app + cheap pay-per-minute cloud". Topaz bundles subscriptions; open-source tools have no cloud and no polish.

# Competitor analysis

- **Primary competitor (full study):** [topaz-analysis.md](topaz-analysis.md). It covers Topaz Labs' video and image upscalers: features, models, limits, pricing, front-end stack and API shape, all observed from public pages and the visitor-visible web app.

**Landscape.** Figures other than Topaz's are approximate, from general knowledge as of 2026; verify them before quoting.

| Product | Type | Strength | Weakness vs Clarion |
|---|---|---|---|
| Topaz Video / Gigapixel / Topaz for Web | Desktop + cloud | Best quality (Starlight diffusion), 20+ models, pro codecs | $59/mo desktop, credits for cloud, complex |
| Upscayl | Free OSS desktop (Real-ESRGAN, ncnn) | Free, simple | Images only, no cloud, no faces/video |
| Video2X | Free OSS | Video + RIFE | Advanced UI, no cloud |
| Let's Enhance / Magnific / Krea | Web image | Polished, creative upscaling | Images only, subscriptions |
| CapCut / VEED enhancers | Built into editors | Distribution, free tier | Capped quality and resolution |
| AVCLabs / HitPaw VikPea / Pixop | Desktop or web video | Pay-per-use options | Dated UX, watermarks on free tiers |

**Where Clarion wins:** local-first (private, free), a preview-before-render flow, a clean wipe compare, honest defaults ("4K is the useful ceiling"), and later a cheap cloud for people without GPUs.

**Where it loses today:** no diffusion models, no deinterlacing or stabilisation, no SDR→HDR, no mobile app.

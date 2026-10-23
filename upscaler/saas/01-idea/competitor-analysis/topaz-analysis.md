# Topaz Labs upscaling — feature and architecture analysis

Scope: the **video upscaler** and **image upscaler** only. Studied 2026-10-23 as an anonymous visitor.

Method: the built-in browser read the public pages, and REA `capture_browser_scenario` ran one headless Chrome load of `app.topazlabs.com/image/upscale` with network, console and accessibility capture (Evidence `ev_d898642bc7b73a1fb3f6ec8bb9b48e6423bdfded3912c7499d23a9d303c5f929`). I also statically string-searched the JS chunks and the public `model-config.yaml` that the app page itself downloads.

Not done: no sign-in or sign-up, and no calls to authenticated endpoints. No uploads, and no Topaz desktop binaries or model weights were touched. Everything behind the login modal is inferred from bundled code and marked **[bundle]**. Facts taken from marketing pages are marked **[site]**. Facts seen on the wire are marked **[observed]**.

---

## 1. Product surface

Topaz sells the same model families in three places.

| Surface | Where it runs | Relevant to us |
|---|---|---|
| Marketing "tools" pages (`/tools/video-upscale`, `/tools/image-upscale`) | Webflow static pages; every CTA deep-links into the web app | Shows the user flow and the feature list |
| **Topaz for Web** (`app.topazlabs.com`) | Browser UI; inference runs on Topaz cloud GPUs | Main functional target |
| Desktop apps (**Gigapixel** for images, **Topaz Video** for video) | Local GPU on Mac/Windows, with optional cloud rendering; standalone or as a plug-in (Photoshop/Lightroom; After Effects/DaVinci Resolve) | Defines the "full" feature set |

## 2. Image upscaler — features

### User flow [site]
1. Upload a photo (drag-and-drop or picker). Sample images are offered to try first.
2. The AI upscales automatically. Settings are optional; the landing page says no manual adjustments are needed.
3. Download the result. A before/after slider is shown on the marketing page and in the app.

### Scale factors [bundle]
`scale_factor` is a param of type `upscale` with the choices **1×, 2×, 4×, 6×, 8×** (default 4×). 1× means enhance only. The marketing pages call 8× the maximum, and Gigapixel desktop advertises 6×. Cloud export is capped at **32 MP** on the web plans [site].

### Model variants
Display names are shown here only to map them to the open-source equivalents in §6.

| Purpose | Topaz model(s) | Tunable params [bundle] |
|---|---|---|
| General photo | Upscale Standard, Standard MAX | deblur, denoise and decompression strength (0–1, default 0.5); opacity |
| Faithful / already-good input | High Fidelity (v2, v3) | as above / `recovery_strength` |
| Very small or low-quality input | Low Resolution | as above |
| Art, CG, illustration | Upscale CGI ("Art & CG") | deblur, denoise |
| Text, logos, shapes | Text Recovery / "Text & Shapes" / Graphic Enhancer | as Standard |
| Generative "creative" | Wonder 3/3.5/4, Bloom 1/2/Realism/Precision, Redefine | creativity (1–6), text prompt, auto-prompt, seed, face preservation |
| Faces (post step) | Face Recovery (Natural, v3), Face Pristine | strength 0–1 |
| Restore (pre steps) | Denoise Normal/Strong/Max, Sharpen Standard/Strong/Lens/Motion, Auto Sharpen, Dust-Scratch | denoise/sharpen strength 0–1 |
| Finishing | optional film-grain mix-in on most models | grain on/off, size, density |

Several models accept an optional **ROI mask** and a **reference image** input [bundle].

### Autopilot [bundle]
Classifier models return JSON scores rather than images: Upscale Autopilot, noise detection, blur detection, false-resolution detection, age-of-photo, subject classifier, face quality, image quality. An "Auto" workflow uses these to pick the model and strengths for each image, which is why the site says "no adjustments needed". A reranker can compare several candidate outputs and keep the best one.

### Formats and batches
- Inputs: JPG, PNG, WebP, TIFF; HEIC and DNG are offered on desktop [bundle/site].
- Outputs: PNG/JPG/TIFF/WebP via a server converter (`/api/image/convert`) [bundle].
- Batch: drop many files; one workflow applies to all of them. The image plan allows 2 concurrent cloud renders [site].

## 3. Video upscaler — features

### User flow [site + bundle]
1. Upload a video (`accept="image/*,video/mp4,.mp4"` on the web picker [observed]; the bundle also handles mov/mkv/webm).
2. Pick a workflow (Precise Upscale, Creative Upscale, Frame Interpolation, Slow Motion, SDR→HDR) and its model.
3. Set the output: resolution (1080p / 4K, from source-relative choices), frame rate, SDR/HDR, codec. A chip bar shows these values; the defaults seen were `Starlight Precise 2.6 · 4k · 30 FPS · SDR · H.264` [observed].
4. **Preview** a short segment and tweak settings before committing [site].
5. Render the full clip and download it. Long clips are split into chunks automatically (`/api/video/split`) [bundle].

### Model catalogue [bundle]

| Model | Kind | Best for | Credits per unit (1080p / 4K) | Max frames |
|---|---|---|---|---|
| Starlight Precise 2.6 / 2.5 / 2 | Diffusion | best realism, faces/skin; 2.6 adds a sharpness slider (0–10, default 5) | 5 / 10 | 9000 (450 for v2) |
| Starlight Fast 2/3, Starlight Mini | Diffusion | faster; Mini targets fast motion and old footage | 5 / 10–12 | 9000 |
| Proteus (and Proteus Fast) | GAN | general purpose, tunable | 2 / 8 | unlimited |
| Iris | GAN | faces, low-quality input | 2 / 8 | unlimited |
| Nyx | GAN | denoise | 2 / 8 | unlimited |
| Gaia HQ / Gaia CG | GAN | art, CG, animation | 2 / 8 | unlimited |
| Rhea | GAN | slow close-ups | 8 / 8 | unlimited |
| Astra 1/2 | generative | "creative upscale", mainly for GenAI clips | separate Astra credits | – |
| Hyperion 2.5 | Diffusion | SDR→HDR | 5 / 10 | – |
| Apollo (apo-8) | interpolation | frame-rate conversion and slow motion | – | – |

Marketing "AI presets" map onto these models: Film & TV, Sports, Gaming, Old Video, Art & CG, Standard [site]. The desktop app adds motion deblur (Themis), stabilization, deinterlacing, grain and "20+ models" [site].

### Output options [bundle]
- **Resolution**: up to 4K; models are rejected if the output would be under their 1080p minimum (`output-below-model-minimum`).
- **Frame rate target**: Original, 24, 25, 30, 60, 90, 120 fps via Apollo interpolation.
- **Slow motion**: factor applied through Apollo (`slowmo` multiplier; None/2×/…).
- **Sharpen** and **restore strength** sliders; **fast mode** on/off.
- **Dynamic range**: SDR, or HDR via Hyperion.
- **Format**: H.264 (SDR only, default), H.265 10-bit (HDR), ProRes 422 Proxy/LT/422/HQ/4444/4444 XQ, ProRes 10-bit, EXR 16-bit, EXR 16-bit ACES, plus VP9/AV1 in the browser muxer.
- **Audio**: copied through unchanged (`audioTransfer: "Copy"`).

### Preview / comparison [bundle]
The video player component takes `beforeVideoUrl` and `afterVideoUrl` and has zoom, pan, slow-mo playback and a grain overlay toggle, i.e. a synced before/after comparison. The image app has an equivalent slider.

## 4. Limits and pricing [site + observed `/api/products`]
- Topaz for Web: Image from $12/mo (annual), with unlimited cloud image rendering and a 32 MP export cap. Video from $19/mo, credit-metered. Pro bundles both.
- Desktop: Gigapixel $29/mo (unlimited local and cloud image rendering). Topaz Video $59/mo (unlimited local rendering + 25 cloud video credits). Topaz Studio (all apps) $69/mo, with 300 video credits.
- Cloud-credit packs: 80 credits $9.99 … 20 000 credits $999.99 a month. Render plans: Lite $14, Plus $24, Pro $49 a month.
- Video cost is credits × length, scaled by output resolution (table in §3). Diffusion models cap clip length at 9000 frames (5 min at 30 fps).
- Commercial use is limited to organisations under $1M/yr revenue on personal plans.

## 5. Architecture

### Front end [observed]
- Marketing site: **Webflow** + jQuery, GSAP, Cookiebot, Statsig (`featureassets.org`), HubSpot forms, Trustpilot widgets, Typekit.
- Web app: **SvelteKit** SPA (`/_app/immutable/…`, Svelte 5 runes), behind **Cloudflare** (bot challenge script on load). Payments use **Stripe**, support uses the HelpScout Beacon, analytics run through server-side GTM (`sgtm.topazlabs.com`).
- In-browser media: **Mediabunny** (WebCodecs muxing/demuxing, codec capability probing, H.264/HEVC level tables) and **onnxruntime-web** WASM (`ort-wasm-simd-threaded`). These are likely used for client-side probing, thumbnails, masking or autopilot helpers; the heavy upscaling runs on the server.
- A node-graph workflow engine: the console logs "Initialized registry with 85 node types". Each model in `model-config.yaml` declares typed input/output ports (`image`, `alpha`, `json`), so user "workflows" (custom intents) are graphs of model nodes.

### Back end and API shape [observed + bundle]
REST under `app.topazlabs.com/api/*`, with `Authorization: Bearer <token>` for signed-in users.

| Concern | Calls |
|---|---|
| Session | `GET /api/session` → anonymous visitors get "No session found" and a sign-in modal |
| Upload | `POST /api/file-data` (name, type, size) → `201 {id, uploadId?}`; then chunked **multipart** `PUT` parts in parallel; then `PUT /api/file-data/{id}`. Anonymous sample files use `?noUser=true` [observed 3× POST 201 + 3× PUT 200] |
| Model catalogue | `GET /neurostudio/model-config.yaml` (public, ~75 KB) |
| Workflows | `/api/custom-intents`, `/api/video-workflows`, `/api/workflow-folders` |
| Jobs | `POST /api/transactions` / `…/batch` → `/api/transactions/process/{id}`; poll `/api/transactions/{id}`, `/api/transactions/feed`, `/api/transactions/active-video`; `/api/eta` |
| Video | `/api/video/split` (chunking), `/api/video/proc` |
| Files | `/api/files/{id}`, `/api/files/tar` (bulk download), `/api/collections/*` |
| Billing | `/api/billing/balance`, `/api/products`, `/api/subscription/*`, Stripe setup intents |
| Public API | `https://api.topazlabs.com/image/v1` (separate developer product) |

Processing model: **the cloud does the work**. The browser uploads the source, creates a "transaction" naming the model and its params, and polls for progress. The output is then a file the browser downloads. For long videos the server splits the clip into chunks, processes them in parallel, and joins them.

## 6. Mapping to an open-source equivalent

| Topaz capability | Open-source building block (licence) |
|---|---|
| Standard / Low-Res / High-Fidelity photo upscale | Real-ESRGAN x4plus, x2plus (BSD-3); optionally SwinIR / HAT (Apache-2.0 / MIT) for fidelity |
| Art & CG / animation (Gaia) | Real-ESRGAN x4plus-anime-6B, realesr-animevideov3 (BSD-3) |
| Fast general video model (Proteus-like) | realesr-general-x4v3 (BSD-3), which has a **denoise-strength** knob via weight interpolation (wdn variant) |
| Face recovery (Iris / Face Recovery) | GFPGAN v1.4 (Apache-2.0). CodeFormer is S-Lab non-commercial, so make it optional only |
| Denoise / deblur / decompression sliders | the realesr-general denoise knob plus classic ffmpeg/OpenCV filters (`hqdn3d`, `nlmeans`, unsharp) |
| Frame interpolation / slow-mo (Apollo) | RIFE 4.x (MIT) or ffmpeg `minterpolate` as a CPU fallback |
| Container/codec output | ffmpeg: H.264, H.265 10-bit, ProRes, VP9/AV1; audio stream copy |
| Preview a short segment | trim N seconds with ffmpeg, then run the same pipeline |
| Before/after compare | slider for images; synced dual `<video>` with a split wipe for video |
| Autopilot | simple heuristics (resolution, a noise estimate, face detection) to suggest a model |
| Diffusion / creative models (Starlight, Wonder, Bloom, Astra, Hyperion) | **Out of scope for an MVP**: they need far more VRAM than a 4 GB GPU. Possible later: StableSR / SUPIR (licence review needed) |

## 7. Unknowns
- Exact output resolution ladder and slow-mo factor list (computed at runtime from source size; not observable without a session).
- Server-side chunk size, GPU types and queueing.
- Whether the image app runs any upscaling on the client via onnxruntime-web (only the WASM files were seen; no model file fetch was observed on the anonymous load).

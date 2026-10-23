# TurboScribe — feature and architecture analysis

Studied on 2026-10-22, using only what an anonymous visitor's browser receives. Nothing was uploaded to TurboScribe, no account was created and no backend endpoint was probed.

## How the evidence was gathered

| Source | What it gave | Limits |
|---|---|---|
| Landing page `https://turboscribe.ai/`, loaded in the built-in browser pane | Visible text, DOM structure of the upload form, script and stylesheet list, Performance API resource list, JSON-LD FAQ | One page only |
| REA `capture_browser_scenario` (headless Chrome) | Network log for the first visit | Cloudflare answered with **403 and a Turnstile challenge**, so only the challenge traffic was captured |
| Later navigation to `/blog/...` and a WebFetch of the same URL | — | Both hit Cloudflare's "verify you are human" page or a 403. Stopped there on purpose; bot checks were not bypassed |
| Third-party reviews (one web search) | Descriptions of the transcript viewer and export dialog | Second-hand and partly contradictory. Marked **[reported]** below |

Everything not marked **[reported]** was observed directly on the landing page.

## 1. What the product does

A web app that turns audio or video files into text with OpenAI's Whisper models, adds optional speaker labels, and lets users read, translate and export the result.

### 1.1 Input
- **File upload** through a drag-and-drop zone (Dropzone.js) or a file picker. Sortable.js is also loaded, probably to reorder files queued for upload.
- **Formats:** MP3, M4A, MP4, MOV, AAC, WAV, OGG, OPUS, MPEG, WMA, WMV, AVI, FLAC, AIFF, ALAC, 3GP, MKV, WEBM, VOB, RMVB, MTS, TS, QuickTime and DivX. In practice, anything ffmpeg can decode.
- **Links:** marketing copy lists "YouTube" next to the file formats, and there is a `/l/transcribe-youtube-videos` landing page, so URL import exists. Whether it is free or paid-only is unknown.
- **Limits:**
  - Free: 3 files a day, each up to 30 minutes, one at a time, lower queue priority.
  - Paid: up to 10 hours or 5 GB per file, 50 files per batch, highest priority.

### 1.2 Upload options (fields of the upload form)
| UI label | Form field | Values |
|---|---|---|
| Audio Language | `language` | About 140 entries in three groups ("Popular", "More High Accuracy", "Other"). The default is auto/English |
| Transcription Mode | `whisper-model` (radio) | `base` = "Cheetah / Fastest", `small` = "Dolphin / Balanced", `large-v2` = "Whale / Most Accurate" |
| Recognize Speakers | `bool:diarize?` | Checkbox |
| Number of speakers | `int:num-speakers` | 2–8, or `-1` = detect automatically |
| Transcribe to English | `bool:translate-to-english?` | Checkbox. Whisper's built-in `translate` task |
| Restore Audio | `bool:clean-up-audio?` | Checkbox. AI noise removal before transcription |
| (hidden) | `json:handles` | JSON list of upload handles. Files are uploaded first, then the form submits only references to them |

Field names use a type prefix (`bool:`, `int:`, `json:`). This points to a server-side form decoder that converts values by prefix. The `?` suffix on boolean names is a Clojure naming convention, so the backend is probably Clojure.

### 1.3 After transcription (mostly [reported])
- A transcript viewer next to an audio/video player. Text is split into paragraphs or segments, a "Show Timestamps" toggle shows time codes, and clicking plays from that point.
- Speakers appear as "Speaker 1", "Speaker 2" and so on, and can be renamed.
- **Export:** TXT, DOCX, PDF, SRT, VTT and CSV (observed in the FAQ). An "Advanced Export" dialog [reported] has options to include timestamps and speaker names and to set subtitle segment length.
- **Translation:** a "Translate" button on any transcript opens a tool that translates the transcript or subtitles into 134+ languages and downloads the chosen format (observed in the FAQ).
- **Bulk actions:** export or delete many files at once. There is a blog post on bulk export and file management.
- **Storage:** files and transcripts are kept encrypted. Users can delete them, and paid plans have unlimited storage.
- **AI summaries or chat:** no direct evidence. Reviews disagree. There is a ChatGPT "GPT" listed in the footer. Treat this as optional or unknown.

### 1.4 Accounts and plans
- Anonymous trial: the landing page says "No Account Required". The upload form works before sign-in, and a Google OAuth link carries state `attempt-anonymous-upgrade`, so anonymous uploads are later attached to a new account.
- Sign-in with email or Google OAuth.
- Pricing: Free; Unlimited at $20/month or $10/month billed yearly. Stripe handles payments.

## 2. Front-end architecture (observed)

- **Server-rendered multi-page app.** No React, Vue or Next globals. Pages are full HTML from the server. **Turbolinks 5.2** swaps page bodies on navigation, and the meta tag `turbolinks-cache-control=no-cache` is set.
- **Styling:** Tailwind CSS v3 plus a daisyUI-style component layer (`dui3-*` class prefix, `bg-base-200` theme tokens).
- **Own JS:** one `runtime.js` bundle per app (`/js/apps/web/runtime.js`) and an i18n `translations.js`, both under a deploy-versioned path `/_content/versioned/<build-uuid>/`. Assets carry signed query strings (`?s=…`), and images are resized on the fly (`/_content/image/id/<id>.avif?w=96&h=96`).
- **Third-party libraries, self-hosted under `/_content/thirdparty/`:** Dropzone 6 beta, Sortable 1.15, Turbolinks, ThumbmarkJS (browser fingerprinting, likely to enforce free-tier limits), and svgmoji emoji icons.
- **Same-origin calls seen on page load:** `GET /_levscript/json` (fetch, likely client config or bootstrap) and `/_fp` (fingerprint report).
- **Analytics and ads:** Google Analytics 4 through a first-party subdomain proxy, Google Ads, Meta Pixel, Bing UET, X/Twitter ads, OpenAI ads pixel.
- **Edge:** Cloudflare with Bot Management and Turnstile. Headless and automated clients are challenged.

### Likely upload flow
Inferred from the form shape. The actual upload request was not observed.
1. Dropzone sends each file straight to object storage or an upload endpoint and gets back a *handle*.
2. Handles are collected into `json:handles`.
3. Submitting the form sends the handles and options, which creates one transcription job per file.
4. The browser goes to a file or dashboard page that shows queue position and progress, then the transcript.

## 3. What an equivalent app needs

1. Upload with drag and drop (several files) and URL import, with the same options as 1.2.
2. Durable job queue with status (queued → preparing → transcribing → diarizing → done/failed) and progress.
3. Media pipeline: ffmpeg normalisation to 16 kHz mono WAV, optional denoise, Whisper transcription with word timestamps, optional diarization, optional translate-to-English.
4. Library: list, open, rename, delete, bulk export and delete.
5. Transcript viewer: synced media player, click-to-seek, active-segment highlight, timestamps toggle, speaker rename, inline text edit, search.
6. Exports: TXT, DOCX, PDF, SRT, VTT, CSV (and JSON), with timestamp and speaker options.
7. Translation of finished transcripts into other languages.
8. Optional extras: accounts and quotas, summaries.

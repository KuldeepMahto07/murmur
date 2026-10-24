# Harbor

A segmented download manager, built from a study of what Internet Download Manager does.

- The study used only IDM's public website and docs: [saas/01-idea/competitor-analysis/idm-analysis.md](saas/01-idea/competitor-analysis/idm-analysis.md).
- The product, go-to-market and business plan follow a 16-stage lifecycle: [saas/README.md](saas/README.md).
- Harbor is original code, with its own name and design.
- The plan and design notes are in [docs/plan.md](docs/plan.md).

## Install (Windows)

Run `Harbor-Setup-<version>.exe`, built with `npm run installer` into `dist/`.
- It installs for your user only (no admin prompt) and bundles everything it needs, including Node.js.
- It adds Harbor to the Start menu. Options: a desktop shortcut, starting with Windows, and video-site support.
- Your settings and download list stay in `%APPDATA%\Harbor`, and new downloads go to `Downloads\Harbor`. Uninstalling (Settings → Apps) or upgrading keeps both.
- The installer isn't code-signed yet, so Windows SmartScreen may show "Windows protected your PC". Choose *More info → Run anyway*. Signing is on the roadmap.

## Run

**Recommended (Windows tray app):** double-click `download-manager\desktop\Harbor.vbs`.
- It starts the engine with no console window and puts a Harbor icon in the system tray.
- Double-click the icon to open the UI. Right-click it for **Start/Stop queue**, **Pause all**, **Start with Windows** and **Quit**.
- A notification pops up when a download finishes (noting a verified checksum) or fails.
- Only one tray runs at a time. If an engine is already running, the tray attaches to it.
- Quitting the engine from anywhere closes the tray too.

**Or run it in a console:**

Requires Node.js 24 or newer. There are no npm packages to install.

```bash
download-manager/start.bat
```

or run it directly:

```bash
node download-manager/engine/main.ts --port 8765
```

Then open http://127.0.0.1:8765. Downloads go to `download-manager/data/Downloads/<Category>` by default; change this in Settings. State lives in `data/state.json`.

## What works (MVP)

- **Segmented downloads:** up to 32 connections per file, with dynamic splitting. Idle connections halve the largest remaining segment, and keep-alive sockets are reused.
- **Pause and resume:** pause, resume, and automatic recovery after a crash or kill. Synced progress is saved every second.
- **Resume check:** on resume, 16 KB of overlap is compared with the disk and a segment that doesn't match is fetched again.
- **Fallbacks:** if a server ignores ranges, the download falls back to one connection.
- **Retries:** with backoff. You can refresh an expired URL in the details pane.
- **Checksums:** SHA-256 and MD5 of every finished file, with an optional expected value that is checked.
- **Queue:** a concurrency limit. A manual start bypasses the queue.
- **Categories:** chosen by file type, each with its own folder.
- **Speed limits:** global and per download, adjustable while running.
- **Daily scheduler:** start and stop times. When finished it can do nothing, exit, or shut down the PC (with a 60 s warning).
- **UI:**
  - Category sidebar, and a sortable, filterable list.
  - Details pane with a live segment map, a per-connection table, checksums and an event log.
  - Add dialog. You can also paste a URL anywhere to add it.
  - Light and dark themes.
  - Keyboard: N to add, Space to pause or resume, Del to remove.

## Browser extension (download button on videos)

`extension/` is a Manifest V3 extension for Chrome and Edge.

**What it does:**
- **Download button on videos:** hovering a video (or starting playback) shows a **Download** button at the video's top-right. Clicking it lists the media the page has loaded: direct files (MP4, WebM, MP3…) with their size, and each quality of an HLS stream (for example 1080p, 720p, 480p). Picking one sends it to Harbor.
- **File naming:** HLS videos are named from the page title and saved as MP4, joined with ffmpeg. Separate audio tracks are merged in.
- **Browser details passed on:** the cookies, referer and user agent go with the download, so sites that check them still work.
- **Other ways in:** right-click → *Download link / media with Harbor*. The toolbar popup lists the tab's media and has an option to **take over normal browser downloads** (off by default).

**YouTube, Instagram and other sites, via yt-dlp:** added at the owner's request on 2026-10-23.
- **How it works:** on sites like YouTube (including Shorts), Instagram, Facebook, X, TikTok, Vimeo and Reddit, or on any page where nothing else is found, the menu asks [yt-dlp](https://github.com/yt-dlp/yt-dlp) through the Harbor engine. It lists qualities (for example 2160p to 360p MP4, and audio only) with size estimates.
- **The download:** runs in Harbor with progress, pause and resume (yt-dlp continues its partial files), and gets a SHA-256 when it finishes. The page's cookies are passed in a temporary cookies file, which is deleted after each run.
- **Requirements:**
  - Harbor must be running, even when AB DM is the selected destination.
  - yt-dlp must be installed: `winget install yt-dlp.yt-dlp`, which also installs Deno (needed for YouTube) and FFmpeg.
- **Switching it off:** use the popup option "Use yt-dlp for YouTube, Instagram and similar sites".
- **Your responsibility:** downloading from these platforms can break their terms of service. Use it for your own uploads, Creative Commons content, or with the creator's permission.
- **Store builds:** the Chrome Web Store and Edge Add-ons don't allow this. A store build must ship with this feature removed. See [saas-marketplaces](saas/10-distribution/saas-marketplaces/README.md).

**What it won't do:**
- **DRM-protected video** (Netflix, Disney+, Prime Video and the like). The menu says it is protected; yt-dlp refuses DRM too.
- **Encrypted or live HLS** in the built-in HLS downloader. These are listed as blocked.

**Install (unpacked):**
1. Start Harbor (`start.bat`). If it was already running, restart it so the engine has the new routes.
2. Open `chrome://extensions` (or `edge://extensions`) and switch on **Developer mode**.
3. Click **Load unpacked** and pick the `download-manager/extension` folder.
4. Play any page video, hover it, and click **Download**.

The extension talks to the engine at `http://127.0.0.1:8765`. Change the port in the popup if you run the engine on another one.

### Sending downloads to AB Download Manager instead

[AB Download Manager](https://github.com/amir1376/ab-download-manager) (Apache-2.0) is a mature open-source download manager. Harbor's video button can hand downloads to it instead of to the Harbor engine.

1. Install AB DM separately, for example with `winget install amir1376.ABDownloadManager`, and start it. Its browser integration (port 15151) is on by default.
2. Open the extension popup, choose **Send downloads to → AB Download Manager**, and set the port.
3. If you set an API key in AB DM's settings, enter the same key in the popup.

Choosing an entry calls AB DM's own integration API, `POST /add`, so AB DM opens its add-download dialog:
- **Files** are sent as `http` items. **HLS qualities** are sent as `hls` items with the chosen quality's playlist.
- The page's cookies, referer and user agent go with each item.

AB DM itself doesn't download YouTube (its YouTube and yt-dlp support requests are still open issues). yt-dlp menu entries therefore always go to Harbor, even when AB DM is selected.

## Harbor Pro (licensing)

**Free** is the full downloader: speed, resume, crash recovery, SHA-256, queue, scheduler times, the video button, HLS, yt-dlp and the AB DM hand-off.

**Pro** adds:
- up to 32 connections per download (Free allows 8)
- actions when a scheduled queue finishes (shut down the PC, or close Harbor)

**Getting Pro:** Settings → Harbor Pro → *Start 14-day free trial* (no card), or paste a licence key.

**How keys work:**
- Keys are Ed25519-signed and checked offline. There's no account and no phone-home.
- The engine enforces the limits, so they can't be bypassed from the UI or the extension.
- If a trial or yearly key ends, the app returns to Free without interrupting anything.

**Issuing keys (vendor):**

```bash
node scripts/license-tool.ts issue --email buyer@example.com --plan lifetime
```

- `--plan yearly` gives a key that expires after a year.
- Check any key with `node scripts/license-tool.ts verify <key>`.
- The signing key is in `%USERPROFILE%\.fetchline-vendor\` and never in this repository. **Back that folder up:** without it you can't issue keys that existing builds accept.

## Develop, test and release

```bash
npm test
```
```bash
npm run build
```
- **`npm test`:** 17 unit tests (`tests/engine.test.ts`, `tests/license.test.ts`).
- **`npm run build`:** writes to `dist/`:
  - the store extension zip (yt-dlp stripped and checked)
  - the direct extension zip
  - the Windows app zip
  - `SHA256SUMS.txt`
- **`npm run installer`:** builds `dist/Harbor-Setup-<version>.exe` (Inno Setup 6). `scripts/verify-installer.ps1` tests install, run, upgrade and uninstall.
- **CI:** `.github/workflows/fetchline.yml` runs every suite on Windows for changes under `download-manager/`, including the installer.
- **Landing site:** `site/` is static (home, FAQ, privacy, comparisons). Serve it with any static host.

## Verify

```bash
node download-manager/scripts/verify.ts
```

The script starts the engine as a separate process. It downloads with 8 connections, pauses and resumes, hard-kills the process and restarts it, and then checks the SHA-256.

- **Local phase:** a 48 MB throttled range server. It also corrupts bytes on disk to prove the resume check catches them.
- **Public phase:** `linux-6.6.tar.xz` (140 MB) from cdn.kernel.org, checked against the published `sha256sums.asc`.

For the extension, run:

```bash
node download-manager/scripts/verify-extension.ts
```

This builds a test site with ffmpeg. The site has an MP4 player, a 3-quality HLS stream (one quality with separate audio) and an AES-encrypted playlist. The script loads the unpacked extension into headless Edge and checks the following:
1. Hovering shows the button in the right corner, and it hides when the pointer leaves.
2. The menu lists the MP4, all three HLS qualities and a blocked "Encrypted stream".
3. Clicking the MP4, 480p and 360p entries sends each one to a real engine.
4. The MP4 is byte-identical to the source, and the referer and user agent were forwarded.
5. Both HLS downloads are MP4s at the right resolution, with audio, 20 s long, and named from the page title.

A second phase switches the extension to AB Download Manager and checks the exact `/add` requests against a stand-in that implements AB DM's published API (`/ping`, `/add`, `X-Api-Key`). With `--real-abdm`, the stand-in relays the calls to the installed app on port 15151 instead. Tested against AB Download Manager v1.11.1 (installed with winget) on 2026-10-23:
- It accepted both `/add` requests from the extension (`200 OK`) and opened its add dialog.
- Given the same items through `/start-headless-download`, it downloaded the MP4 byte-identical and the 360p HLS stream as a 20 s 360p video with audio.

It passed 3 runs out of 3 on 2026-10-23 (Harbor phase); the AB DM phase passed on its first run.

With `--youtube`, a further phase opens a real YouTube page: Blender's *Big Buck Bunny*, which is CC-BY. It checks four things:
- the Download button appears over YouTube's player
- the menu lists yt-dlp's qualities (2160p to 360p, plus audio only)
- clicking **360p MP4** downloads it through Harbor
- the file is 360p H.264 with audio, 635 s long, filed under Video with a SHA-256

This phase passed 2 runs out of 2. An engine-level check also passed: pausing a 720p yt-dlp download stopped every yt-dlp process within 217 ms, and resuming continued from the partial file.

Engine test, last run (2026-10-23), all checks passed:

| | Local, 48 MB | Public, 140 MB |
|---|---|---|
| Parallel connections | 8 | 8 |
| Segments from dynamic splitting | 8 | 9 at 55%, 23 by the end |
| Progress across the hard kill | 33.3 MB at the kill, 27.9 MB saved | 79.3 MB at the kill, 76.5 MB saved |
| Resume check | caught 64 corrupted bytes and re-fetched that segment | n/a |
| SHA-256 | matches | `d926a06c…` matches the published value |

On the public file, peak throughput was about 5.6 MB/s, against about 2.5 MB/s from a single `curl` connection. The whole run took 38 s, including the pause, the kill and the restart.

## Not in the MVP yet

- Clipboard watcher (pasting into the window works)
- Site grabber
- Multiple and sync queues, and download quotas
- Proxy support
- FTP

See [docs/plan.md](docs/plan.md).

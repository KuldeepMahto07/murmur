# IDM feature and architecture study

Subject: Internet Download Manager (IDM) 6.4x for Windows, by Tonec.
Sources: only the public website at internetdownloadmanager.com, studied on 2026-10-23. That covers the home page, `features2.html`, the `support/` user guide (main dialog, starting downloads, options, properties, complete dialog, scheduler, queues, grabber wizard and settings, segmentation) and the `register/new_faq/` FAQ answers.
Not used: the installer and binaries were not downloaded, decompiled or run. Nothing about licensing or registration was studied.

Everything below is paraphrased. No IDM text, artwork or branding is reused in our app.

## Evidence legend

Each feature is tagged with the kind of source behind it:

- **[doc]**: the user guide or FAQ explains how it behaves.
- **[faq]**: a troubleshooting answer reveals internal behaviour indirectly.
- **[mkt]**: only marketing copy mentions it. No mechanism is described.
- **[shot]**: inferred from a public screenshot.

## How the site was studied

- **REA `capture_browser_scenario`** (headless Chrome, evidence `ev_8f2d920f…`).
  - Home page: static HTML with one stylesheet and one jQuery script.
  - All 81 recorded network events go to the same origin. There are no third-party trackers and no API.
  - Nothing on the marketing site is dynamic, so the useful evidence is the prose documentation and the screenshots.
- **Help pages:** these are static HTML too, so their text was read page by page.
- **FAQ:** its index pages (`*_main.cgi`) only link to the answers. The individual answers were read where they covered engine behaviour.

## 1. Download engine

| Feature | What IDM does | Evidence |
|---|---|---|
| Multi-connection download | Opens several HTTP/HTTPS/FTP connections to one file. Users set a default number of connections. Per-server exceptions can force a lower count, for example 1 for servers that limit connections per client. | [doc] Options → Connection |
| Dynamic segmentation | Splits the file during the download, not once up front. When a connection becomes free, IDM halves the largest remaining segment and gives the new connection the second half. Segments below a minimum size, which depends on connection type, are not split. | [doc] segmentation page |
| Connection reuse | A connection that finishes its segment takes over the next piece without reconnecting or logging in again, which saves handshakes. | [doc]/[mkt] |
| Progress persistence | Segment positions are saved "several times per minute", so pause, stop or power loss lose little work. | [doc] |
| Resume | Uses the server's resume support (HTTP `Range`). The progress dialog shows "Resume capability: Yes/No". There is an option to ignore `Last-Modified` changes for servers that change the timestamp on every request. | [doc]/[shot] |
| Resume integrity check | On resume IDM re-reads a few bytes that overlap the previous chunk and compares them. If they differ, that part is downloaded again. If several connections disagree, it restarts the file with one connection. | [faq] problems9 |
| Temp file layout | Segments are written as separate part files in a temporary folder. On completion they are "rebuilt" into the final file, or simply moved when the temp folder and destination are on the same drive. Rebuilding is slow when antivirus scans every write. | [faq] problems5, functions17 |
| Timeouts and retries | Users choose a connection timeout. In a queue, a failed file goes to the back of the queue. The last remaining file is retried every 30 s, or up to an optional retry limit. | [doc] |
| Checksums | **Not described anywhere.** The site mentions no MD5/SHA verification, only the resume overlap check. | gap |
| Antivirus hook | After a download finishes, IDM can run a chosen scanner with a filename placeholder. | [doc] Options → Downloads |
| Protocols | HTTP, HTTPS and FTP (with a PASV option). MMS is mentioned. | [doc]/[mkt] |
| Auth | Basic, NTLM, Negotiate and Kerberos. A "Site Logins" table stores credentials per URL, and per directory on the same host. | [doc]/[mkt] |
| Proxy | Can copy the system or browser proxy, be set per protocol, use a PAC script, or follow whatever proxy the browser used for that request. HTTP and SOCKS are supported, with a bypass list that accepts wildcards. | [doc] |
| User agent | A configurable user agent for downloads added manually. Captured downloads reuse the browser's headers. | [doc] |

## 2. Download list, categories and UI

- **Main window** [doc]/[shot]:
  - Menu bar: Tasks, File, Downloads, View, Help, plus a licensing menu (out of scope).
  - Large toolbar: add URL, resume, stop, stop all, delete, delete completed, options, scheduler, start queue, stop queue, grabber.
  - Left tree: All Downloads (with category children), Unfinished, Finished, Grabber projects, Queues.
  - Right: a sortable download table.
- **Columns:** file name, queue marker "Q", size, status (percent), time left, transfer rate, last try date, description. Columns can be reordered, shown or hidden, and resized.
- **Categories** [doc]:
  - Each has a name, a list of file extensions, an optional site filter with wildcards, and a default folder.
  - Defaults: Compressed, Documents, Music, Programs, Video.
  - A new download is put in a category by extension (and site) and saved to that category's folder.
- **Progress window** per download [shot]/[doc]:
  - URL, status, total size, downloaded (with percent), transfer rate, time left and resume capability.
  - Tabs for that download's speed limiter and for options on completion.
  - "Show details" expands a per-connection table and a segment map.
  - Pause and Cancel buttons.
  - Users can hide it, or show it minimised.
- **Add / file info dialog** [doc]:
  - URL, category, save folder, file name and description.
  - Buttons: Start now, Download later (to a queue, with an optional queue picker) and Cancel.
  - Option to start downloading while the dialog is still open.
- **Properties** [doc]: edit the save path, URL (useful when a link expires) and description. Open the file.
- **Complete dialog** [doc]: open the file, open the folder, drag the file out. A "don't show again" box, which can be re-enabled in options.
- **Other** [doc]/[mkt]:
  - Drag and drop links in; a floating "drop target" window.
  - Toolbar skins, a light and a dark theme.
  - Event sounds and about 30 UI languages.
  - Settings live in the registry (`HKCU\Software\DownloadManager`). Moving the registry key plus the temp folder migrates everything.

## 3. Queues and scheduler

- **Queues** [doc]:
  - Two built-in queues: main download and main synchronisation. Users can add any number of custom queues.
  - Download queue: a file leaves the queue once complete.
  - Synchronisation queue: files stay in the queue and are re-checked periodically, and re-downloaded if they changed on the server.
  - Each queue has its own "files downloaded at once" limit.
  - Files are ordered with arrows or drag and drop, and can be moved between queues.
  - Queue membership shows in the Q column.
  - By default, new "download later" items go to the main queue.
- **Scheduler, per queue** [doc]:
  - Start now, or start at a set time.
  - Stop at a set time.
  - Repeat a sync queue every N minutes or hours.
  - Retry limit per file.
  - Actions when finished: hang up the dial-up link, shut down the PC (optionally force-closing apps), or open a file or run a program. These actions are skipped when the user stopped the queue by hand.
- **Download quota** [doc]: at most X MB per time period, after which IDM pauses and resumes automatically. This is aimed at fair-use ISPs.
- **Speed limiter** [faq] functions11:
  - A global toggle in the Downloads menu or the tray.
  - The cap applies to **each download**, not to the total. Four downloads at 100 KB/s can reach about 400 KB/s.
  - Each download's progress window also has its own limiter tab.
- **Wake from sleep** for scheduled downloads [faq index].

## 4. Getting downloads in

| Path | Behaviour | Evidence |
|---|---|---|
| Browser extension ("integration module") | Chrome, Edge, Firefox and Opera extensions take over link clicks whose extension is in a configurable file-type list. Sites and URLs can be excluded with wildcards. Holding a modifier key forces capture (Ctrl) or skips it (Alt), and the keys can be changed. The extension also adds a context menu item to download a link, or all links in the selection. | [doc] |
| Handoff mechanism | **Not documented.** FAQ error pages ("browser cannot launch IDM", "cannot transfer download") point to a native helper process. Native messaging is the standard Manifest V3 way to do this; that is an inference. | [faq]/inference |
| "Advanced" integration | Captures downloads from any application, presumably by hooking the network stack. Users fall back to "basic" mode if it causes trouble. | [doc]/[mkt] |
| Clipboard monitor | Copying a URL with a watched extension pops up a prompt. Confirming starts the download. | [doc] |
| Add URL | Manual entry, plus a URL history. | [doc] |
| Command line | Flags: `/d URL`, `/p dir`, `/f name`, `/a` (add to queue only), `/s` (start queue), `/n` (silent), `/q` (quit when done), `/h` (hang up when done). | [doc] |
| Download All / selected links | A floating button appears when several links are selected on a page. | [doc]/[mkt] |

## 5. Video / media grabber panel

[doc] video5 FAQ, everything else [mkt]:
- The extension watches pages for media. When a player starts playing, a floating "download this video" panel appears over it and lists every format and quality it detected.
- Clicking an entry starts a normal download. The page title becomes the file name if the server sends none.
- Captures always start from the beginning, wherever the user is in playback.
- Some downloads come out as MKV, which suggests audio and video tracks are fetched separately and muxed afterwards.
- Subtitles can be downloaded in some cases.
- Playlists and whole-site batches are **not** supported.
- The site does not explain how detection works (network sniffing vs. page parsing), and does not mention HLS or DASH.

**Our scope (constraint):** direct media files plus ordinary unencrypted HTTP progressive and HLS (`.m3u8` with clear segments). We will not handle DRM (Widevine, PlayReady, FairPlay) and will not write per-site scrapers that defeat a platform's download protection.

## 6. Site grabber (spider)

[doc] grabber pages:
- **Step 1: start URL.** Optional login, or a manual browser login with a list of logout pages to avoid. Project name, and a template (pictures, audio, video, whole site).
- **Step 2: where to save.** Save by category folder or to one folder. Option to keep the site's relative subfolders. Option to rewrite links so pages work offline. Overwrite, or add `_2` to duplicate names. Option to add the checked files to the main list.
- **Step 3: explore filters.** Depth on the start site and on other sites. Current site only. Skip popups. Don't go above the start path. Include subdomains of the main domain. Optional JavaScript execution. Include/exclude wildcards for domains and paths.
- **Step 4: file filters.** File types with wildcards, and a `<start page>` token. Files on this site only. Hide duplicates (same name and size). Download every match automatically. Include/exclude paths. Minimum and maximum size.
- **Settings:** how many pages are explored at once and how many files download at once. Link text becomes the file description. Option to look in the browser cache first.
- **Projects:** saved under "Grabber projects" in the tree, and can be scheduled to run once, stop at a time, or run periodically to sync.

## 7. What we infer about the architecture

These are inferences, not observations:

1. **Native Windows app** with one long-lived process. It holds the download table, scheduler and tray icon, and a helper handles browser click monitoring.
2. **Per-download state** is a list of segments, each with offset, end and bytes received. It is flushed every few seconds to part files plus metadata, and that metadata is what makes crash recovery possible.
3. **Scheduler** is a timer loop over queue definitions, each with a concurrency limit, start/stop times, a repeat interval and a completion action.
4. **Browser bridge**: the extension sends the URL, cookies, referrer, user agent and POST data to the app, and the app asks for confirmation through its own dialog.

## 8. What maps to our MVP vs. later

| Area | MVP | Later |
|---|---|---|
| Segmented HTTP(S) engine with dynamic splitting, persisted state, crash-safe resume and a resume overlap check | ✅ | FTP |
| Pause, resume, retry with backoff, redirects, `Content-Disposition` names | ✅ | |
| SHA-256 / MD5 checksum (computed, plus an optional expected value) — a gap in IDM, worth adding | ✅ | |
| Queue with a concurrency limit and categories by extension | ✅ | multiple queues, sync queues |
| Speed limit (global and per download) | ✅ | quotas |
| Scheduler (start/stop time, action when done) | basic | shutdown action |
| UI: tree, table, add dialog, details with a segment map | ✅ | themes, i18n |
| Proxy (HTTP), basic auth, custom headers | partial | SOCKS, NTLM |
| Browser extension (MV3) and native messaging | — | ✅ |
| Clipboard monitor | — | ✅ |
| Media panel (direct files and clear HLS) | — | ✅ |
| Site grabber | — | ✅ |

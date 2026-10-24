# UX flows

**Status: Done.** Part of [04 · Design](../README.md) in the [Harbor SaaS plan](../../README.md).

## Flows that work today
1. **Add by URL:** paste anywhere or press N → dialog → Start now / Add to queue / Add paused.
2. **Video:** hover a video → Download → pick a quality → sent to Harbor or AB DM. Encrypted or DRM content gets a clear explanation.
3. **Crash:** kill the app → restart → downloads resume on their own from the last checkpoint.
4. **Integrity:** paste an expected `sha256:` value → the download turns red on a mismatch.

## Gaps
- **No first-run guide.** It should cover how to install the extension and that the engine must be running. The tray app (`desktop/Harbor.vbs`, with an optional Start with Windows) removes the need for `start.bat`. The "not running" message should point to it once there's an installer.
- **YouTube expectations.** The menu explains, but the store listing must say so up front.

## Update (2026-10-24): flows documented end to end

**1. Install → first run.** Run `Harbor-Setup-<v>.exe` (per-user, no admin) → Start menu + optional start-at-sign-in → the tray starts the engine hidden and opens the window. First launch shows the **welcome guide**: download folder → connect browser (ticks itself when the extension connects) → connection speed → start with Windows → a verified test download.

**2. Add a download.** Paste a link anywhere, or press **N**, or the **＋** button → the New Download sheet (save-as, category, folder, connections, speed limit, expected checksum) → Start now / Add to queue / Add paused. A finished file shows ✓ with its SHA-256.

**3. Video on a page.** Hover a video → the **Download** pill → a menu lists direct files, each HLS quality, and (direct build) YouTube/Instagram qualities; DRM/encrypted/live are shown blocked → pick one → it lands in Harbor. Destination can be Harbor or AB Download Manager (popup).

**4. Pro.** Settings → Fetchline Pro → *Start 14-day trial* (no card) or paste a licence key → unlocks 32 connections and scheduler completion actions. Lapsing reverts to free limits without interrupting downloads.

**5. Browser pairing (optional).** Settings → *Require browser pairing* → the app shows a 6-digit code → enter it once in the extension popup → the extension is trusted; other programs without the token are refused.

**6. Crash / dropped connection.** Progress is flushed every second; on restart, downloads resume themselves and re-check the overlap before continuing.

**Gaps:** a packaged first-run that installs the extension automatically (today it's load-unpacked / store); an in-app "what's new".

# SaaS marketplaces (app & extension stores)

**Status: In progress.** Part of [10 · Distribution](../README.md) in the [Fetchline SaaS plan](../../README.md).

For a desktop app plus an extension, the "marketplaces" are the app and extension stores:

**Two extension builds (since 2026-10-23):**
- **Store build:** the yt-dlp code in `background.js` and `content.js` is stripped, and the popup option is hidden.
- **Direct build:** yt-dlp on, as in `extension/` today.

Add a build script that produces both zips. The store listing must not mention YouTube or Instagram downloading.

| Store | What to publish | Notes |
|---|---|---|
| **Chrome Web Store** | Store-build zip | One-time developer registration fee. Policy forbids enabling unauthorized downloads of copyrighted media, so describe it as sending downloads and openly served media to a desktop download manager. Needs a privacy disclosure (cookies are read only to pass to the user's own app). |
| **Microsoft Edge Add-ons** | Same zip | Free Partner Center account; separate review |
| **winget** | Signed installer from GitHub Releases | PR a manifest to `microsoft/winget-pkgs` (AB DM is listed as `amir1376.ABDownloadManager`, so follow that pattern) |
| **Microsoft Store** | MSIX, or a Win32 installer listing | Free registration for individual developers through storedeveloper.microsoft.com (ID verification) |
| **Firefox Add-ons** | Port of the extension | Later: needs MV3/`webRequest` differences handled |

## Update (2026-10-24)
- **Store build:** `npm run build` produces `fetchline-extension-store-<v>.zip`. The build removes every `@ytdlp` block and fails if any yt-dlp, YouTube or Instagram wording remains, or if a script no longer parses.
- **Verified:** the stripped build passes the full extension suite in headless Edge (`verify-extension.ts --ext <unzipped store build>`).
- **Next:** create the Chrome Web Store and Edge Partner Center accounts (owner), then upload the store zip with the privacy policy URL ([`site/privacy.html`](../../../site/privacy.html)).

# SaaS marketplaces (app & extension stores)

**Status: Not started.** Part of [10 · Distribution](../README.md) in the [Fetchline SaaS plan](../../README.md).

For a desktop app plus an extension, the "marketplaces" are the app and extension stores:

| Store | What to publish | Notes |
|---|---|---|
| **Chrome Web Store** | `extension/` zip | One-time developer registration fee. Policy forbids enabling unauthorized downloads of copyrighted media, so describe it as sending downloads and openly served media to a desktop download manager. Needs a privacy disclosure (cookies are read only to pass to the user's own app). |
| **Microsoft Edge Add-ons** | Same zip | Free Partner Center account; separate review |
| **winget** | Signed installer from GitHub Releases | PR a manifest to `microsoft/winget-pkgs` (AB DM is listed as `amir1376.ABDownloadManager`, so follow that pattern) |
| **Microsoft Store** | MSIX, or a Win32 installer listing | Free registration for individual developers through storedeveloper.microsoft.com (ID verification) |
| **Firefox Add-ons** | Port of the extension | Later: needs MV3/`webRequest` differences handled |

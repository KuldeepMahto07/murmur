# DevOps

**Status: In progress.** Part of [06 · Infrastructure](../README.md) in the [Harbor SaaS plan](../../README.md).

## Release process to set up
1. **Versioning:** semver in one place, with `manifest.json` and the app version kept in step by a script.
2. **Build:** desktop package (see [development-plan](../../03-planning/development-plan/README.md)) and the extension zip (`extension/` with no test files).
3. **Code signing:**
   - Windows app: a cloud signing service such as Azure Artifact Signing, or an OV/EV certificate. Without signing, SmartScreen warns every new user.
   - Extension: the stores sign it.
4. **Publish:** GitHub Release → winget manifest PR (`microsoft/winget-pkgs`) → Chrome and Edge store uploads.
5. **Changelog:** generated from commit messages for each release.

## Update (2026-10-24)
- [`scripts/build.ts`](../../../scripts/build.ts) (`npm run build`) writes to `dist/`:
  - the **store** extension zip (yt-dlp stripped and checked)
  - the **direct** extension zip
  - the Windows app zip
  - `SHA256SUMS.txt`
- The zip writer is built in, so there are no dependencies. Zips are reproducible (fixed timestamps) and open with Windows' `Expand-Archive`.
- Version is kept in sync between `package.json` and `extension/manifest.json`; the build fails on a mismatch.
- **Still to do:** code signing, an installer (MSIX or Inno Setup), and the release job in CI.

## Update (2026-10-24): Windows installer
- **Build:** `npm run installer` creates `dist/Harbor-Setup-<version>.exe` (about 24 MB) with Inno Setup 6. The Node.js runtime and its licence are bundled, so users don't need Node. See [`installer/harbor.iss`](../../../installer/harbor.iss) and [`scripts/build-installer.ts`](../../../scripts/build-installer.ts).
- **Install:** per-user into `%LOCALAPPDATA%\Programs\Harbor`, no admin prompt.
  - Start menu entry; optional desktop shortcut and "Start in the tray when I sign in".
  - Optional "Video-site support" step, which runs winget.
- **Data:** settings and the download list live in `%APPDATA%\Harbor`, and new installs download to `Downloads\Harbor`. Uninstall and upgrades keep both.
- **Upgrade and uninstall:** they stop a Harbor running from the install folder first ([`installer/stop-harbor.ps1`](../../../installer/stop-harbor.ps1), matched by process path, never a copy started elsewhere), then replace or remove the files and remove the Apps entry.
- **Tested:** [`scripts/verify-installer.ps1`](../../../scripts/verify-installer.ps1) passes 28/28: silent install → runs on the bundled Node → verified download → upgrade over a running copy (data kept) → uninstall leaves nothing behind. It also runs in CI.
- **Still to do:** code signing (needs a certificate or Azure Artifact Signing; until then SmartScreen warns), then the winget manifest.

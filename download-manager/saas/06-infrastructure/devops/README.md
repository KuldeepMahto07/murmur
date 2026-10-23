# DevOps

**Status: Partial.** Part of [06 · Infrastructure](../README.md) in the [Fetchline SaaS plan](../../README.md).

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

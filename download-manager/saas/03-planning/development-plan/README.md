# Development plan

**Status: In progress.** Part of [03 · Planning](../README.md) in the [Harbor SaaS plan](../../README.md).

## Next 6 weeks
| Week | Work | Done when |
|---|---|---|
| 1 | Pick the shell. **Interim done:** a PowerShell tray app (`desktop/`). Still to do: try a Node SEA build or Electron for a packaged installer | A one-file prototype starts on a clean VM |
| 2 | ✅ Tray icon, notifications, start with Windows, single instance (`desktop/tray.ps1`, verified by `scripts/verify-tray.ps1`) | ✅ The engine runs with no console window |
| 3 | Installer (MSIX or Inno Setup) and a code-signing pipeline | Windows SmartScreen shows our publisher name |
| 4 | Clipboard watcher; extension polish (options page, icons) | Store assets ready |
| 5 | GitHub Actions CI running `scripts/verify.ts --local` and `verify-extension.ts` | Green on every PR |
| 6 | Publish to the Chrome Web Store, Edge Add-ons and winget | Listings live |

## Rules
- Every feature lands with a check in `scripts/`.
- No YouTube or DRM extraction, ever. See [feature-prioritization](../feature-prioritization/README.md).

## Update (2026-10-24)
- Week 3: the **installer is done** (`npm run installer`, tested end to end). Code signing is waiting on a certificate; that's an owner step.

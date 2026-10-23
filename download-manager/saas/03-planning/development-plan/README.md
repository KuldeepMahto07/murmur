# Development plan

**Status: In progress.** Part of [03 · Planning](../README.md) in the [Fetchline SaaS plan](../../README.md).

## Next 6 weeks
| Week | Work | Done when |
|---|---|---|
| 1 | Pick the shell: try a Node SEA build of the engine and Electron for the UI and tray | A one-file prototype starts on a clean VM |
| 2 | Tray icon, notifications, start with Windows, single instance (port claim already done in `engine/main.ts`) | The engine runs with no console window |
| 3 | Installer (MSIX or Inno Setup) and a code-signing pipeline | Windows SmartScreen shows our publisher name |
| 4 | Clipboard watcher; extension polish (options page, icons) | Store assets ready |
| 5 | GitHub Actions CI running `scripts/verify.ts --local` and `verify-extension.ts` | Green on every PR |
| 6 | Publish to the Chrome Web Store, Edge Add-ons and winget | Listings live |

## Rules
- Every feature lands with a check in `scripts/`.
- No YouTube or DRM extraction, ever. See [feature-prioritization](../feature-prioritization/README.md).

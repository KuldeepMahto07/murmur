# Wireframes

**Status: Partial.** Part of [04 · Design](../README.md) in the [Harbor SaaS plan](../../README.md).

## What exists
There are no separate wireframe files. The layout was designed directly in code, and the current screens act as the wireframes:
- **Main window:** a top bar (add, resume, pause, pause all, remove, queue, settings, theme) above a left sidebar (views and categories). In the middle, a sortable list (Name, Q, Size, Progress, Speed, Time left, Status, Added). At the bottom, a details pane (segment map, connections table, per-download settings, log).
- **Dialogs:** New download, and Settings (connections, queue limit, global limit, scheduler, categories).
- **Video overlay:** a "Download" pill at the video's top-right, which opens a menu (files, HLS qualities, blocked entries).

## Missing
- Low-fidelity wireframes for the planned desktop shell's tray menu and notifications, and for an options page in the extension.
- An onboarding screen for the first run (extension install, folder choice).

## Update (2026-10-24): store screenshots
- First store assets captured at 1280×800 in [`site/store/`](../../../site/store/):
  - `01-main-window.png` — the main window with sample downloads (complete / paused / queued), dark.
  - `02-video-download.png` — the video Download menu over a player (qualities + blocked DRM).
- Captured with headless Edge against the app with sample data (`site/store/README.md`).

## Update (2026-10-25): promo tile + light-mode hero
- The 440×280 small promo tile is built: [`site/store/03-promo-tile-440x280.png`](../../../site/store/03-promo-tile-440x280.png), with a reproducible HTML source (`site/store/promo-tile.html`) that reuses the logo mark and the `ui/tokens.css` palette.
- The 1400×560 light-mode marquee / hero is built: [`site/store/04-hero-1400x560.png`](../../../site/store/04-hero-1400x560.png) (source `site/store/hero.html`) — headline on the left, a light-theme app-window illustration (download rows, progress, segment map) on the right. Balances the dark store screenshots.
- **Still to do:** low-fidelity wireframes for the tray menu and extension options page.

# Store assets

Screenshots for the Chrome Web Store / Edge Add-ons listings, 1280×800 PNG.

- `01-main-window.png` — main window, sample downloads, dark theme.
- `02-video-download.png` — the video Download menu over a player.

Regenerate the main window: start the app with sample data, then
`msedge --headless=new --window-size=1280,800 --screenshot=01-main-window.png http://127.0.0.1:<port>/`.
The listing text must not mention YouTube/Instagram downloading (store policy); those work only in the direct build.

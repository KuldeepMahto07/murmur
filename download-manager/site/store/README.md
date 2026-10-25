# Store assets

Images for the Chrome Web Store / Edge Add-ons listings. Screenshots are 1280×800 PNG; the small promo tile is 440×280 PNG. All art is Harbor's own — no Apple or third-party assets.

- `01-main-window.png` — main window, sample downloads, dark theme.
- `02-video-download.png` — the video Download menu over a player.
- `03-promo-tile-440x280.png` — small promo tile (logo, wordmark, tagline). Source: `promo-tile.html`.

Regenerate the promo tile from its source (exact 440×280):
`chrome --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=440,280 --screenshot=03-promo-tile-440x280.png "file:///…/promo-tile.html"`.
Edit `promo-tile.html` to change the wording; the layout and palette match `ui/logo.svg` and `ui/tokens.css`.

Regenerate the main window: start the app with sample data, then
`msedge --headless=new --window-size=1280,800 --screenshot=01-main-window.png http://127.0.0.1:<port>/`.
The listing text must not mention YouTube/Instagram downloading (store policy); those work only in the direct build.

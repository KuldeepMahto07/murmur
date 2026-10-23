# Cloud hosting

**Status: Not started.** Part of [06 · Infrastructure](../README.md) in the [Fetchline SaaS plan](../../README.md).

Fetchline runs on the user's PC, so there is no app server to host. The only hosted pieces are:

| Need | Plan | Cost |
|---|---|---|
| Website and docs | Cloudflare Pages or GitHub Pages (static) | Free |
| Downloads | GitHub Releases (installer, zip, checksums) | Free |
| Update feed | `latest.json` on Pages, read by the app's update check | Free |
| Licence sales | Merchant of record (Lemon Squeezy or Paddle) | About 5% plus fees per sale |

Keep it this way: no user data leaves the PC, which is a selling point.

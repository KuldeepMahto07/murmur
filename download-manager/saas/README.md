# Harbor: SaaS lifecycle plan

**What Harbor is:** a fast, crash-proof download manager with checksum verification, plus a browser extension that puts a Download button on videos. It is a Windows desktop app; the extension runs in Chrome and Edge. The code lives in [`../engine`](../engine), [`../ui`](../ui) and [`../extension`](../extension), and it stays where it is. This tree holds the research, the plans and the go-to-market strategy.

**Business model:** freemium with a one-time lifetime Pro licence.
- **Free:** speed, resume and verification.
- **Pro:** $19 lifetime or $9/year, for automation and power features.
- **Price anchor:** IDM costs $24.95 lifetime.

**Distribution:** Chrome Web Store, Edge Add-ons, winget, the Microsoft Store and GitHub Releases. Never DRM.

**Decision, 2026-10-23 (owner):** YouTube, Instagram and similar sites are supported through yt-dlp, run by the desktop engine. There are therefore **two extension builds**:
- **Store build:** yt-dlp entries removed, for the Chrome Web Store and Edge Add-ons, whose policies forbid enabling such downloads.
- **Direct build:** yt-dlp on, distributed through GitHub Releases and winget.

Pages below that say "no YouTube" describe the store build and its marketing, which still must not advertise YouTube downloading. See [feature-prioritization](03-planning/feature-prioritization/).

| # | Stage | Status | Next action |
|---|---|---|---|
| 01 | [Idea](01-idea/) | ✅ Done | — (IDM teardown and competitor grid in [competitor-analysis](01-idea/competitor-analysis/)) |
| 02 | [Validation](02-validation/) | 🟡 In progress | Run 15 [customer interviews](02-validation/customer-interviews/) (IDM, AB DM and course users) and test $9 / $15 / $25 |
| 03 | [Planning](03-planning/) | 🟡 In progress | Installer done. **Owner:** code-signing certificate (or Azure Artifact Signing) |
| 04 | [Design](04-design/) | 🟡 In progress | UI, UX flows, shared tokens, store screenshots and the 440×280 promo tile done. Light-mode hero + low-fi wireframes remain |
| 05 | [Development](05-development/) | 🟡 In progress | Engine, UI, API, extension, tray, licensing and browser pairing done. Core build complete |
| 06 | [Infrastructure](06-infrastructure/) | 🟡 In progress | CI, `npm run build`, the **installer** and a tag-triggered **release job** (`npm run release`) are done. Next: code signing, push so CI runs |
| 07 | [Testing](07-testing/) | 🟡 In progress | Unit tests (12) and E2E suites pass. Next: a 2-week [beta](07-testing/beta-testing/) with 30–50 waitlist users |
| 08 | [Launch](08-launch/) | 🟡 In progress | Site built, installer ready. Next: deploy the site; signing + store accounts (owner); work through [public-release](08-launch/public-release/) |
| 09 | [Acquisition](09-acquisition/) | 🟡 In progress | `/vs/idm` and `/vs/ab-download-manager` pages built. Next: guide pages and the first build-in-public post |
| 10 | [Distribution](10-distribution/) | 🟡 In progress | Store zip ready (`npm run build`). **Owner:** open Chrome Web Store and Edge Partner Center accounts, then upload; winget PR after signing |
| 11 | [Conversion](11-conversion/) | 🟡 In progress | Trial and gating are live. **Owner:** set up the merchant of record (Lemon Squeezy or Paddle) and put the checkout URL into `BUY_URL` |
| 12 | [Revenue](12-revenue/) | 🟡 In progress | Licence keys and the vendor tool are built. Next: purchase webhook → `license-tool issue`; founders' pre-sale at $12 |
| 13 | [Analytics](13-analytics/) | 🟡 In progress | Update check built (anonymous, on by default, Settings toggle + Check Now). Next: opt-in events — needs a telemetry endpoint (owner) |
| 14 | [Retention](14-retention/) | 🟡 In progress | Onboarding, public FAQ, GitHub issue templates and an in-app Copy Diagnostics button are done. Next: a support e-mail (owner) |
| 15 | [Growth](15-growth/) | ⚪ Not started | Shareable verification report; `fetchline://` "Download with Harbor" button |
| 16 | [Scaling](16-scaling/) | 🟡 In progress | Release automation built (`npm run release` + tag-triggered GitHub Release). Next: signing, winget PR, store publish APIs (owner) |

**Statuses:**
- **Done:** every sub-item is done.
- **In progress:** at least one sub-item is done, partial or drafted.
- **Not started:** strategy written, nothing executed yet.

Each stage folder has a README with its sub-items. Last updated 2026-10-25.

# Fetchline: SaaS lifecycle plan

**What Fetchline is:** a fast, crash-proof download manager with checksum verification, plus a browser extension that puts a Download button on videos. It is a Windows desktop app; the extension runs in Chrome and Edge. The code lives in [`../engine`](../engine), [`../ui`](../ui) and [`../extension`](../extension), and it stays where it is. This tree holds the research, the plans and the go-to-market strategy.

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
| 03 | [Planning](03-planning/) | 🟡 In progress | [Development plan](03-planning/development-plan/) week 3: installer and code signing. The interim tray shell is done; decide later whether Electron replaces it |
| 04 | [Design](04-design/) | 🟡 In progress | Store screenshots and promo tile (the first-run welcome dialog is done) |
| 05 | [Development](05-development/) | 🟡 In progress | Engine, UI, API, extension and the Windows tray app are done. Next: extension pairing token, licence keys |
| 06 | [Infrastructure](06-infrastructure/) | 🟡 In progress | CI workflow and `npm run build` are done. Next: push so CI runs, then code signing and an installer (MSIX or Inno Setup) |
| 07 | [Testing](07-testing/) | 🟡 In progress | Unit tests (12) and E2E suites pass. Next: a 2-week [beta](07-testing/beta-testing/) with 30–50 waitlist users |
| 08 | [Launch](08-launch/) | 🟡 In progress | [Landing site](08-launch/landing-page/) built in `site/`. Next: domain + Cloudflare Pages deploy; work through the [public-release](08-launch/public-release/) list |
| 09 | [Acquisition](09-acquisition/) | 🟡 In progress | `/vs/idm` and `/vs/ab-download-manager` pages built. Next: guide pages and the first build-in-public post |
| 10 | [Distribution](10-distribution/) | 🟡 In progress | Store zip ready (`npm run build`). **Owner:** open Chrome Web Store and Edge Partner Center accounts, then upload; winget PR after signing |
| 11 | [Conversion](11-conversion/) | 🟡 In progress | [Pricing](11-conversion/pricing-strategy/) is drafted. Next: set up the merchant of record and the 14-day Pro trial |
| 12 | [Revenue](12-revenue/) | ⚪ Not started | Offline licence keys (Ed25519); founders' pre-sale at $12 |
| 13 | [Analytics](13-analytics/) | ⚪ Not started | Anonymous update-check count, plus opt-in events (no URLs, ever) |
| 14 | [Retention](14-retention/) | 🟡 In progress | First-run onboarding and the public FAQ are done. Next: issue templates and an in-app "Copy diagnostics" button |
| 15 | [Growth](15-growth/) | ⚪ Not started | Shareable verification report; `fetchline://` "Download with Fetchline" button |
| 16 | [Scaling](16-scaling/) | ⚪ Not started | Release automation (sign, winget, store publish APIs) once revenue starts |

**Statuses:**
- **Done:** every sub-item is done.
- **In progress:** at least one sub-item is done, partial or drafted.
- **Not started:** strategy written, nothing executed yet.

Each stage folder has a README with its sub-items. Last updated 2026-10-24.

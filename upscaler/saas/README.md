# Clarion: SaaS lifecycle status

Each stage below has its own folder of sub-item READMEs. The app's source code stays where it is (see [05-development](05-development/)).

Status as of 2026-10-23.

| # | Stage | Status | Next action |
|---|---|---|---|
| 01 | [Idea](01-idea/) | ✅ Done | Pull search volumes to size the market ([market-research](01-idea/market-research/README.md)) |
| 02 | [Validation](02-validation/) | ⬜ Not started | Run 15 interviews and put up the landing page and waitlist |
| 03 | [Planning](03-planning/) | ✅ Done | Start sprint 1: social presets + deinterlace |
| 04 | [Design](04-design/) | 🟡 In progress | Mobile layout, explain the 4K ceiling in the UI, prototype the cloud flows |
| 05 | [Development](05-development/) | 🟡 In progress | Local MVP done; cloud needs auth, a DB, uploads and a worker queue |
| 06 | [Infrastructure](06-infrastructure/) | ⬜ Not started | Dockerfile for the GPU worker, then benchmark on L4 / RTX 4090 |
| 07 | [Testing](07-testing/) | 🟡 In progress | e2e passes; add pytest units (pass-count regression) and Playwright |
| 08 | [Launch](08-launch/) | ⬜ Not started | Signed installer, then a beta with 20 waitlist users |
| 09 | [Acquisition](09-acquisition/) | ⬜ Not started | Publish the first 5 SEO pages (4K, 60 fps, the "16K" explainer) |
| 10 | [Distribution](10-distribution/) | ⬜ Not started | AlternativeTo and the AI directories, then the Microsoft Store |
| 11 | [Conversion](11-conversion/) | 🟡 In progress | Pricing model drafted from measured GPU cost; validate it with the founding pack |
| 12 | [Revenue](12-revenue/) | ⬜ Not started | Stripe credit packs; subscriptions only once cost is $0.07 per credit or less |
| 13 | [Analytics](13-analytics/) | ⬜ Not started | Add PostHog events for render start, finish and upsell |
| 14 | [Retention](14-retention/) | ⬜ Not started | First-run sample render + GPU speed message |
| 15 | [Growth](15-growth/) | ⬜ Not started | "Export comparison reel" feature (viral loop) |
| 16 | [Scaling](16-scaling/) | ⬜ Not started | Not before product-market fit; queue autoscaling comes with the cloud beta |

**Key number:** GPU cost is about 4.0 GPU-seconds per input megapixel per output frame on a GTX 1650 Ti. The cost per output minute on each cloud GPU, and the credit design built on it, are in [pricing-strategy](11-conversion/pricing-strategy/README.md).

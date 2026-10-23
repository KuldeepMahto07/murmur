# Murmur: SaaS lifecycle

Murmur's business plan, laid out as the 16-stage lifecycle (Idea → Scaling). Murmur's code lives at the repo root (`backend/`, `frontend/`, `scripts/`); [05-development](05-development/) points to it. This folder holds only docs. *Other projects in this repo (`upscaler/`, `download-manager/`) have their own `saas/` trees.*

**Positioning:** private transcription that never leaves your PC. Windows + NVIDIA first, for qualitative researchers, then journalists and legal/HR teams.

| # | Stage | Status | Next action |
|---|---|---|---|
| 01 | [Idea](01-idea/) | ✅ Done | — (revisit after interviews) |
| 02 | [Validation](02-validation/) | ⬜ Not started | Recruit 15 interviewees (r/PhD, r/qualitativeresearch) and book the first 5 calls |
| 03 | [Planning](03-planning/) | ✅ Done (MVP) | Start week 2 of the dev plan: guided pyannote setup |
| 04 | [Design](04-design/) | 🟡 In progress | Accessibility pass (contrast, focus, keyboard), then first-run wireframes |
| 05 | [Development](05-development/) | 🟡 In progress | MVP done; build first-run settings (HF token) and an access token before any exposure |
| 06 | [Infrastructure](06-infrastructure/) | 🟡 In progress | Add `requirements.lock` + GitHub Actions; connect Vercel to the repo |
| 07 | [Testing](07-testing/) | 🟡 In progress | Save pytest suite for exports and speaker assignment; run pyannote with a token |
| 08 | [Launch](08-launch/) | ⬜ Not started | Blocked on v0.2 installer; draft the ethics-office template |
| 09 | [Acquisition](09-acquisition/) | ⬜ Not started | Publish the model benchmark post with the real GPU numbers |
| 10 | [Distribution](10-distribution/) | ⬜ Not started | **Decide open-core** (public MIT repo + closed Pro) |
| 11 | [Conversion](11-conversion/) | ⬜ Not started | Pick merchant of record; create the $29 founding-licence product |
| 12 | [Revenue](12-revenue/) | ⬜ Not started | After validation: offline-signed licence keys |
| 13 | [Analytics](13-analytics/) | ⬜ Not started | Cookie-free analytics on the demo; define the opt-in event schema |
| 14 | [Retention](14-retention/) | ⬜ Not started | Design the first-run wizard (hardware check, model download progress) |
| 15 | [Growth](15-growth/) | ⬜ Not started | Set up GitHub Discussions / Discord once beta starts |
| 16 | [Scaling](16-scaling/) | ⬜ Not started | Write the `release.md` and `dependency-upgrades.md` runbooks |

**The critical path right now:** 02 Validation (do people pay for "local") runs in parallel with the 03 dev plan → v0.2 installer → 07 beta → 08 launch.

Last updated: 2026-10-23.

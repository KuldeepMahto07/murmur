# Retell: SaaS lifecycle plan

**What Retell is:** give it a viral clip (file or link) and it makes a narrated commentary video in the "things you missed" style: freeze-frames, zooms, circles, arrows and spotlights, a TTS voiceover with word-highlight captions, and sound effects. Today it is a local Python CLI. The code lives in [`../retell.py`](../retell.py) and [`../engine`](../engine); this tree holds the research, plans and go-to-market strategy.

**Reference:** Mirror Thinks (~517k subscribers, 3–5 hours per video by hand). Closest tool: MoneyPrinterTurbo, which never looks at a specific clip. See [01-idea](01-idea/).

**Roadmap:** MVP CLI (now) → local web UI → hosted SaaS (queue + CPU render workers).

**Rule for this project:** the MVP was built ahead of Validation. No new features until the interviews and the landing-page test in stage 02 are done.

| # | Stage | Status | Next action |
|---|---|---|---|
| 01 | [Idea](01-idea/) | 🟡 In progress | Problem, niche, competitors and opportunity written. 🤖 Market research: count channels in the niche and their upload rate; mine r/NewTubers and r/PartneredYoutube for editing-time complaints |
| 02 | [Validation](02-validation/) | ⬜ Not started | 👤 Interview 10–15 faceless commentary creators (time per video, tools, what they'd pay). 🤖 Landing page with a before/after demo video and a waitlist |
| 03 | [Planning](03-planning/) | 🟡 In progress | MVP scope, stack, roadmap and feature list done. 🤖 Write the `development-plan/` for the web UI, re-ranked by interview results |
| 04 | [Design](04-design/) | ⬜ Not started | 🤖 Wireframes for the web UI: drop clip → beat timeline → drag effects on the frame → render |
| 05 | [Development](05-development/) | 🟡 In progress | MVP CLI built (`make`, `plan`, `prep`, `sheet`, `render`). 🤖 After validation: faster-whisper transcript into the plan, then 9:16 vertical output |
| 06 | [Infrastructure](06-infrastructure/) | ⬜ Not started | 🤖 Pin `requirements.txt` versions and add a GitHub Actions job that renders `scripts/test_plan.json` |
| 07 | [Testing](07-testing/) | 🟡 In progress | Manual end-to-end run on the synthetic clip (`scripts/make_test_clip.py`) works. 🤖 pytest units for `plan.py` schema checks and `render.py` timeline maths |
| 08 | [Launch](08-launch/) | ⬜ Not started | 🤖 After the web UI: beta with 20 waitlist creators. 👤 Pick the launch channel (Product Hunt or creator communities) |
| 09 | [Acquisition](09-acquisition/) | ⬜ Not started | 👤 Run a demo channel made with Retell (build-in-public proof). 🤖 SEO pages: "Mirror Thinks style editor", "auto commentary video maker" |
| 10 | [Distribution](10-distribution/) | ⬜ Not started | 🤖 List on AlternativeTo and AI tool directories once there is a landing page |
| 11 | [Conversion](11-conversion/) | ⬜ Not started | 🤖 Draft pricing from measured render cost per minute (free tier with a watermark, paid per video or monthly) |
| 12 | [Revenue](12-revenue/) | ⬜ Not started | 👤 Pick a merchant of record (Lemon Squeezy or Paddle). 🤖 Founders' pre-sale tested in stage 02 |
| 13 | [Analytics](13-analytics/) | ⬜ Not started | 🤖 Define events: clip uploaded, plan edited, render finished, video exported |
| 14 | [Retention](14-retention/) | ⬜ Not started | 🤖 First-run sample clip that renders in under a minute; saved voice and style presets |
| 15 | [Growth](15-growth/) | ⬜ Not started | 🤖 Optional "Made with Retell" end card on free renders (viral loop) |
| 16 | [Scaling](16-scaling/) | ⬜ Not started | Not before product-market fit; render worker queue comes with the hosted version |

**Statuses:**
- ✅ **Done:** every sub-item is done.
- 🟡 **In progress:** at least one sub-item is done, partial or drafted.
- ⬜ **Not started:** nothing executed yet.

👤 the owner does it · 🤖 Claude does it. Each stage folder has a README with its sub-items. Last updated 2026-10-25.

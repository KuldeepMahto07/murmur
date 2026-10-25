# User tracking

**Status: In progress.** Part of [13 · Analytics](../README.md) in the [Harbor SaaS plan](../../README.md).

**Built:** the daily update check (`engine/update.ts`) is live — one anonymous GET to the GitHub Releases API, on by default, with a Settings toggle and a "Check Now" button. That request is the "active installs" signal (counted store-side); Harbor sends no identifiers with it. **Still owner-gated:** opt-in product events need a telemetry endpoint (no backend exists yet) and the "Show me what's sent" view.

**Privacy first:** a download manager sees every URL a user fetches, so analytics must never include URLs, file names or cookies.

| Signal | Source | Default |
|---|---|---|
| Installs and uninstalls | Chrome Web Store and Edge dashboards; winget and GitHub Release download counts | Always (store-side) |
| Active installs | Count of requests for the update check (`latest.json`) | Always, anonymous |
| Product events (app started, first download done, Pro prompt shown, trial started, licence activated) | Opt-in telemetry: an event name, app version and a random install ID; nothing else | **Off** until the user opts in on first run |
| Website | Plausible (cookie-free) | Always |

**Implementation:** batch the events and send them with the update check, so there's no extra network chatter. Add a "Show me what's sent" button in Settings.

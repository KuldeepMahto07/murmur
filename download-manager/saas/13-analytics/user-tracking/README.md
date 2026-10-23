# User tracking

**Status: Not started.** Part of [13 · Analytics](../README.md) in the [Fetchline SaaS plan](../../README.md).

**Privacy first:** a download manager sees every URL a user fetches, so analytics must never include URLs, file names or cookies.

| Signal | Source | Default |
|---|---|---|
| Installs and uninstalls | Chrome Web Store and Edge dashboards; winget and GitHub Release download counts | Always (store-side) |
| Active installs | Count of requests for the update check (`latest.json`) | Always, anonymous |
| Product events (app started, first download done, Pro prompt shown, trial started, licence activated) | Opt-in telemetry: an event name, app version and a random install ID; nothing else | **Off** until the user opts in on first run |
| Website | Plausible (cookie-free) | Always |

**Implementation:** batch the events and send them with the update check, so there's no extra network chatter. Add a "Show me what's sent" button in Settings.

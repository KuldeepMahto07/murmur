# Authentication

**Status: Done.** Part of [05 · Development](../README.md) in the [Harbor SaaS plan](../../README.md).

- **User accounts:** none. Harbor is a local, single-user app, and the API is protected by its loopback guard (see [apis](../apis/README.md)).
- **Site credentials:** basic auth in the URL is supported (`engine/net.ts`). Cookies come from the browser through the extension.
- **AB DM API key:** the user can set it in the extension popup, and it is sent as `X-Api-Key`.

## Needed for Pro
- **Licence keys:** signed offline keys (an Ed25519 signature over the email and plan), checked locally. No account server and no phone-home. Payments go through a merchant of record. See [12-revenue](../../12-revenue/subscriptions/README.md).
- **Extension pairing token:** stops other local software from driving the engine.
- **Never** build cracking, trial-reset or bypass features, for our own product or anyone else's.

## Update (2026-10-24)
- **Done:** offline licence keys (Ed25519) and the 14-day trial. See [12-revenue/subscriptions](../../12-revenue/subscriptions/README.md).
- **API:** `GET/PUT/DELETE /api/license`, `POST /api/license/trial`.
- **UI:** a Pro panel in Settings.
- **Tests:** 5 unit tests (`tests/license.test.ts`) cover tampering, the wrong signer, expiry, the trial lifecycle and engine gating.
- **Still to do:** the extension pairing token.

## Update (2026-10-24): browser pairing (the pairing token) built
- **Engine** [`engine/pairing.ts`](../../../engine/pairing.ts): a persistent per-install token (`data/pairing.json`, user-only ACL) plus a 6-digit pairing code that rotates each run and after each pair. Authorization for mutating API calls: allowed if first-party (the app's own UI, proven by the browser's `Sec-Fetch-Site: same-origin` header) **or** the request carries the token.
- **Opt-in:** Settings → *Require browser pairing* (off by default, so nothing breaks). When on, the extension must pair once with the code; other local programs without the token get 403.
- **Extension:** sends `X-Harbor-Token`; popup has a pairing box. **Tray:** reads the token from the data folder so its menu still works when pairing is on.
- **Tests:** [`tests/pairing.test.ts`](../../../tests/pairing.test.ts) (5), plus a live engine gate check (off→201, cross-site no token→403, same-origin UI→200, paired token→201).
- **Threat model:** defense in depth between same-user local processes and a hard block on web pages, not a boundary against a program the user runs as themselves (it can read the token file).

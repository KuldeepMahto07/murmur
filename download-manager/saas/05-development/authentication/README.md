# Authentication

**Status: Not started (by design for MVP).** Part of [05 · Development](../README.md) in the [Fetchline SaaS plan](../../README.md).

- **User accounts:** none. Fetchline is a local, single-user app, and the API is protected by its loopback guard (see [apis](../apis/README.md)).
- **Site credentials:** basic auth in the URL is supported (`engine/net.ts`). Cookies come from the browser through the extension.
- **AB DM API key:** the user can set it in the extension popup, and it is sent as `X-Api-Key`.

## Needed for Pro
- **Licence keys:** signed offline keys (an Ed25519 signature over the email and plan), checked locally. No account server and no phone-home. Payments go through a merchant of record. See [12-revenue](../../12-revenue/subscriptions/README.md).
- **Extension pairing token:** stops other local software from driving the engine.
- **Never** build cracking, trial-reset or bypass features, for our own product or anyone else's.

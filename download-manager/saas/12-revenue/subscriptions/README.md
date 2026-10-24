# Subscriptions

**Status: In progress.** Part of [12 · Revenue](../README.md) in the [Harbor SaaS plan](../../README.md).

- **Main revenue:** one-time lifetime licences, which match what the IDM audience expects.
- **Optional yearly plan:** $9/year, to smooth cash flow.
- **Licence format:** a signed key (email, plan, expiry or "lifetime", issue date) checked offline. The merchant of record's licence API is only used for revocation lists, which the app fetches with update checks.
- **Updates policy:** lifetime means lifetime for 1.x and 2.x. Any future "major paid upgrade" gets announced at least 12 months ahead, with a discount for existing owners.

## Update (2026-10-24): licence keys built
- **Format:** `FL1-<base64url payload>.<base64url Ed25519 signature>`. The payload holds id, email, plan (`pro-lifetime` or `pro-yearly`), seats, issued date and expiry. Keys are checked offline in [`engine/license.ts`](../../../engine/license.ts); only the canonical encoding is accepted.
- **Vendor tool:** [`scripts/license-tool.ts`](../../../scripts/license-tool.ts) has `keygen`, `issue --email … --plan lifetime|yearly` and `verify`.
- **Signing key:** the private key lives in `%USERPROFILE%\.fetchline-vendor\`, outside the repo, with a Windows ACL limiting it to the owner. Issued keys are logged to `issued.csv` in the same folder. **Back this folder up.** If it's lost, no new keys can be issued for existing builds.
- **Yearly keys:** they carry an expiry. When it passes, the app returns to Free and says why.
- **Next:** connect the merchant-of-record webhook so a purchase issues a key automatically (`issue` is the building block), plus an optional revocation list fetched with update checks.

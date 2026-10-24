# Churn reduction

**Status: Not started.** Part of [14 · Retention](../README.md) in the [Harbor SaaS plan](../../README.md).

**Why users drop download managers:**
- Broken browser capture after a browser update
- Antivirus false positives
- "It didn't download my YouTube video"
- Nags

**Countermeasures:**
- **Browser updates:** run `verify-extension.ts` in CI against Chrome/Edge Beta weekly, so we fix things before users see them.
- **Antivirus:** code-sign everything and submit each release to Microsoft Defender's false-positive portal.
- **YouTube expectations:** state the limits clearly in the store, on the landing page and in the menu message (already in the product).
- **Uninstall feedback:** the extension's uninstall URL opens a one-question survey with no tracking.
- **Never nag:** at most one upsell per feature, ever.

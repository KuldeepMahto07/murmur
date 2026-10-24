# Checkout optimization

**Status: Not started.** Part of [11 · Conversion](../README.md) in the [Harbor SaaS plan](../../README.md).

- **Merchant of record:** Lemon Squeezy or Paddle. It handles global VAT and sales tax, cards, PayPal and local methods, and has built-in licence-key and affiliate support.
- **In-app flow:**
  - "Upgrade" opens the checkout in the browser, pre-filled with the plan.
  - After paying, the key is shown on the thank-you page and emailed, and the app picks it up through a `fetchline://activate?key=…` link.
- **Offline licence check:** an Ed25519-signed key is verified locally. No account and no phone-home.
- **Friction to remove:** no account creation; one page; support for the local payment methods the merchant of record offers in target regions.
- **Refunds:** a 30-day no-questions refund, which lowers purchase anxiety.

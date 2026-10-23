# Landing page

**Status: Not started.** Part of [08 · Launch](../README.md) in the [Fetchline SaaS plan](../../README.md).

## Sections
1. **Hero:** "Faster, verified downloads for Windows." Buttons: Download for Windows (signed installer) and Add to Chrome / Edge.
2. **Demo GIF:** the segment map filling, then hover video → Download → quality picker.
3. **Three proofs:**
   - "2.2× faster on our test" (5.6 vs 2.5 MB/s), with the method linked.
   - "Survives crashes": the kill-and-restart test.
   - "Every file SHA-256 verified".
4. **Honest limits:** "Doesn't download YouTube, Netflix or DRM video. Here's why." This saves support time and builds trust.
5. **Pricing:** Free versus Pro (see [pricing-strategy](../../11-conversion/pricing-strategy/README.md)).
6. **FAQ:** Is it safe? (code-signed, open source, no adware.) Does it work with AB DM? (Yes, via the hand-off.)

## Checklist
- [ ] Domain and Cloudflare Pages
- [ ] Plausible analytics, cookie-free
- [ ] OG image, favicon (`ui/logo.svg`), and a `SoftwareApplication` schema block
- [ ] Download links point to GitHub Releases, with SHA-256 shown next to each file

# Problem discovery

**Core problem:** people have low-resolution, noisy or compressed photos and clips (old phone footage, social-media re-downloads, AI-generated video at 720p, scanned family photos) and want them to look sharp on today's 4K screens and 1080p+ social feeds.

Pain points we observed or experienced while building Clarion:
- **Plain resizing just blurs.** Bicubic gives soft edges and visible compression blocks. See `upscaler/samples/out/portrait_compare.png` (bicubic on the left, Clarion on the right).
- **The best tools are expensive or need strong hardware.** Topaz Video is $59/mo and its cloud runs on credits (see [competitor-analysis](../competitor-analysis/README.md)). Running locally needs a decent GPU; our 4 GB GTX 1650 Ti took 56 min for a 15 s 4K60 clip.
- **People don't know what to ask for.** A real user asked for "16K 60 fps" for a 720x1280 phone clip. They need sensible defaults (4K tops out what phones and Instagram can show) and an explanation, not a raw resolution picker.
- **Waiting with no feedback.** Long renders need a preview-first flow, progress, an ETA and notifications.

Jobs-to-be-done:
1. "Make this clip look good enough to post." (social creators)
2. "Rescue this old or low-res photo for print." (families, archivists, e-commerce)
3. "Fix the soft, 720p-ish look of my AI-generated video." (GenAI creators; Topaz markets heavily to this group)
4. "Batch-clean a folder of product images." (sellers)

Next: collect evidence with [customer interviews](../../02-validation/customer-interviews/README.md).

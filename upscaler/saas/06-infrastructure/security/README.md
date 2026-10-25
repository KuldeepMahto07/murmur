# Security

**Status: Partial: local basics done; cloud hardening planned.** Part of [06 · Infrastructure](../README.md) in the [Clarion SaaS plan](../../README.md).

**Today:**
- The server binds to localhost.
- Uploads are restricted by extension.
- File-serving only returns names recorded on the job (no path traversal).
- Weights load with `torch.load(weights_only=True)`.

**For the cloud:**
- Validate media with ffprobe before queueing.
- Run ffmpeg in a sandbox with time and memory limits.
- Cap upload size and duration per plan.
- Malware scanning isn't needed for media, but reject anything that isn't a recognised container.
- Signed URLs, auto-delete media after 7 days, encryption at rest.
- GDPR: a delete-account flow, and no training on user content (state it in the ToS).
- Abuse: hash-match known CSAM (PhotoDNA or a provider service) before processing any user uploads.

# Customer support

**Status: Not started (plan written).** Part of [14 · Retention](../README.md) in the [Murmur SaaS plan](../../README.md).

- **Channels:** email (support@), GitHub Discussions (public Q&A), and a docs FAQ. No live chat until revenue supports it.
- **Diagnostics export:** a Settings → "Copy diagnostics" button (version, GPU, CUDA/torch versions, model cache, last 50 log lines, **no content**). This solves most GPU and setup tickets in one reply.
- **Top expected issues + canned answers:**
  1. "Stuck on Loading speech model": first-time download; show progress.
  2. "No GPU used": driver or CUDA mismatch; diagnostics check.
  3. "Speakers wrong": try a fixed speaker count, or set up pyannote.
  4. "PDF shows boxes": a script unsupported by the font; use DOCX.
- **SLA:** 48 h for Pro, 24 h for Team and priority support.

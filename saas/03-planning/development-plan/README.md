# Development plan (next 8 weeks, solo developer)

**Status: Done.** Part of [03 · Planning](../README.md) in the [Murmur SaaS plan](../../README.md).

| Week | Deliverable | Done when |
|---|---|---|
| 1 | Validation kit live: landing page + waitlist + interview recruiting | Page live, first 5 interviews booked |
| 2 | Guided pyannote setup in the UI (token field, terms links, test button) | Diarization method shows "pyannote" after setup |
| 3 | Unit tests + CI (see [07-testing](../../07-testing/), [06-infrastructure/ci-cd](../../06-infrastructure/ci-cd/)) | GitHub Actions green on push |
| 4–5 | Windows installer v0.2 | Fresh Windows VM: install → transcribe sample with no terminal |
| 6 | NVivo-friendly DOCX + find & replace + speaker merge | Researcher beta tester confirms import |
| 7 | License key + Pro gating (offline-verifiable signed keys) | Free vs Pro gates work offline |
| 8 | Beta release to waitlist | 30 beta installs, feedback form |

**Working agreements:** every feature ships with an e2e check in `scripts/e2e.py`. Keep a dated note here at the end of each week.

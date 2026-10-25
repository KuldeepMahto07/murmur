# Churn reduction

**Status: Not started (plan written).** Part of [14 · Retention](../README.md) in the [Murmur SaaS plan](../../README.md).

**Churn signals:** no transcript for 30 days after week 1; repeated `error` events; refund requests; Team server not renewed.

**Actions:**
- **Uninstall survey** (opens a web page after uninstall): 1 question plus an optional comment. Expected reasons: too slow on CPU, speaker accuracy, setup trouble.
- **CPU-only users:** set expectations up front, recommend Swift/Steady, and test an optional paid "cloud burst" add-on later only if the cohort data shows heavy churn.
- **Reliability:** zero data loss (crash recovery already re-queues running jobs). Add autosave for edits (already saved on blur) and an "undo" history.
- **Team renewals:** a usage report 60 days before renewal ("Your lab transcribed 412 hours this year").

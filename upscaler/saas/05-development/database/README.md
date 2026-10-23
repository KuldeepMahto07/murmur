# Database

**Today:** no database. Each job is `upscaler/data/jobs/<id>/job.json`, plus its media files, loaded at startup by `jobs.load_existing()`.

**Needed for the cloud (Postgres):**
- `users(id, email, created_at, plan, stripe_customer_id)`
- `jobs(id, user_id, kind, settings jsonb, status, progress, input_meta jsonb, result jsonb, gpu_seconds, credits_charged, created_at, finished_at)`
- `credit_ledger(id, user_id, delta, reason, job_id, created_at)`: append-only; the balance is a SUM
- `files(id, job_id, role, storage_key, bytes, expires_at)`: delete media after 7 days

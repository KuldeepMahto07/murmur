# Authentication

**Status: Not started (needed for the cloud).** Part of [05 · Development](../README.md) in the [Clarion SaaS plan](../../README.md).

**Today:** none. The app binds to 127.0.0.1 only, which is fine for a local single-user app.

**For the cloud:** email magic link + Google OAuth via a managed provider (Clerk, Supabase Auth or Auth.js). Short-lived JWTs for the API, API keys for business users, and signed short-lived URLs for media downloads.

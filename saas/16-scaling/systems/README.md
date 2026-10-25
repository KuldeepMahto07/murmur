# Systems

**Status: Not started (plan written).** Part of [16 · Scaling](../README.md) in the [Murmur SaaS plan](../../README.md).

**Runbooks to write (in `saas/16-scaling/systems/`):**
- [ ] `release.md`: version bump, changelog, CI build, smoke test on a clean VM, publish, announce.
- [ ] `support.md`: triage tags, canned replies, escalation, diagnostics reading guide.
- [ ] `refunds-and-licences.md`: refund within 14 days, revoke key, transfer licence.
- [ ] `security-incident.md`: what to do if the update channel, signing key or licence key is compromised (key rotation, forced update).
- [ ] `dependency-upgrades.md`: the torch/pyannote/speechbrain compatibility matrix and how to test it (this already bit us once).

**Tools:** one shared drive, one issue tracker (GitHub), and one password manager with 2FA. Keep the code-signing key on a hardware token.

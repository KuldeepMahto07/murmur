// Licence keys and Pro gating. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkKey, signKey, Licensing, TRIAL_DAYS, type LicensePayload } from '../engine/license.ts';
import { Manager } from '../engine/manager.ts';

// A throwaway keypair: tests never touch the real vendor key.
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const PRIV = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
const PUB = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
const other = crypto.generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' }).toString('base64');

const payload = (over: Partial<LicensePayload> = {}): LicensePayload => ({
  v: 1, id: 'abc123', email: 'buyer@example.com', plan: 'pro-lifetime', seats: 3, issued: '2026-10-24', expires: null, ...over,
});
const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'fl-lic-'));

test('checkKey: a signed key verifies and round-trips its payload', () => {
  const key = signKey(payload(), PRIV);
  assert.match(key, /^FL1-[\w-]+\.[\w-]+$/);
  const r = checkKey(key, PUB);
  assert.ok(r.ok);
  assert.equal(r.ok && r.payload.email, 'buyer@example.com');
  assert.ok(checkKey(`  ${key.slice(0, 20)}\n${key.slice(20)}  `, PUB).ok, 'whitespace from copy/paste is ignored');
});

test('checkKey: rejects tampering, the wrong signer, garbage and expired keys', () => {
  const key = signKey(payload(), PRIV);
  const [head, sig] = key.slice(4).split('.');
  const forged = Buffer.from(JSON.stringify({ ...payload(), email: 'thief@example.com' })).toString('base64url');
  assert.equal(checkKey(`FL1-${forged}.${sig}`, PUB).ok, false, 'payload changed after signing');
  assert.equal(checkKey(key, other).ok, false, 'signed by a different private key');
  assert.equal(checkKey('hello', PUB).ok, false);
  assert.equal(checkKey(`FL1-${head}.AAAA`, PUB).ok, false);
  // Changing the final base64url character may only flip padding bits; it must still be rejected.
  for (const c of 'AxQw') if (key.at(-1) !== c) assert.equal(checkKey(key.slice(0, -1) + c, PUB).ok, false, `last char -> ${c}`);
  const yearly = signKey(payload({ plan: 'pro-yearly', expires: '2026-12-31' }), PRIV);
  assert.ok(checkKey(yearly, PUB, Date.parse('2026-12-31T20:00:00Z')).ok, 'valid through the last day');
  const r = checkKey(yearly, PUB, Date.parse('2027-01-01T00:00:01Z'));
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.error : '', /expired on 2026-12-31/);
  assert.equal(checkKey(key, '').ok, false, 'a build without a public key accepts nothing');
});

test('Licensing: free → trial → trial over; trial only once', async () => {
  const dir = await tmp();
  let now = Date.parse('2026-10-24T12:00:00Z');
  const lic = new Licensing(dir, PUB);
  lic.now = () => now;
  await lic.load();
  assert.deepEqual([lic.status().tier, lic.status().pro, lic.status().maxConnections, lic.status().trialAvailable], ['free', false, 8, true]);
  await lic.startTrial();
  assert.equal(lic.status().tier, 'trial');
  assert.equal(lic.status().trialDaysLeft, TRIAL_DAYS);
  assert.equal(lic.status().maxConnections, 32);
  await assert.rejects(lic.startTrial(), /already been used/);
  now += (TRIAL_DAYS - 1) * 86_400_000 + 3_600_000;
  assert.equal(lic.status().trialDaysLeft, 1);
  now += 86_400_000;
  assert.deepEqual([lic.status().tier, lic.status().pro, lic.status().trialAvailable], ['free', false, false]);
  // State survives a restart.
  const again = new Licensing(dir, PUB);
  again.now = () => now;
  await again.load();
  assert.equal(again.status().trialAvailable, false);
  await fs.rm(dir, { recursive: true });
});

test('Licensing: activate, persist, expire to free with a reason, deactivate', async () => {
  const dir = await tmp();
  let now = Date.parse('2026-10-24T12:00:00Z');
  const lic = new Licensing(dir, PUB);
  lic.now = () => now;
  await lic.load();
  await assert.rejects(lic.activate('FL1-nope.nope'), /not valid/);
  await lic.activate(signKey(payload({ plan: 'pro-yearly', expires: '2027-10-24' }), PRIV));
  assert.deepEqual([lic.status().tier, lic.status().email], ['pro', 'buyer@example.com']);
  const reloaded = new Licensing(dir, PUB);
  reloaded.now = () => now;
  await reloaded.load();
  assert.equal(reloaded.status().tier, 'pro');
  now = Date.parse('2027-11-01T00:00:00Z');
  const st = reloaded.status();
  assert.equal(st.pro, false);
  assert.match(st.error ?? '', /expired/);
  await reloaded.deactivate();
  assert.equal(reloaded.status().error, undefined);
  await fs.rm(dir, { recursive: true });
});

test('Manager: free limits are enforced by the engine; the trial lifts them', async () => {
  const dir = await tmp();
  const m = new Manager(dir);
  await m.load();
  try {
    assert.equal(m.maxConnections(), 8);
    assert.throws(() => m.updateSettings({ connections: 16 }), /Pro feature/);
    assert.throws(() => m.updateSettings({ scheduler: { ...m.settings.scheduler, onDone: 'shutdown' } }), /Pro feature/);
    const d = m.add({ url: 'https://x.test/a.iso', connections: 32, start: 'paused' });
    assert.equal(d.connections, 8, 'requests above the free limit are capped');
    assert.throws(() => m.update(d.id, { connections: 20 }), /Pro feature/);

    await m.startTrial();
    assert.equal(m.maxConnections(), 32);
    m.updateSettings({ connections: 16, scheduler: { ...m.settings.scheduler, onDone: 'exit' } });
    assert.equal(m.settings.connections, 16);
    m.update(d.id, { connections: 24 });
    assert.equal(m.get(d.id).connections, 24);
    assert.equal(m.snapshot().license.tier, 'trial');
  } finally {
    await m.shutdown();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

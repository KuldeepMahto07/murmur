// Browser pairing / request authorization. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Pairing, isSameOrigin } from '../engine/pairing.ts';

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'hb-pair-'));

test('isSameOrigin: only the browser same-origin marker counts', () => {
  assert.equal(isSameOrigin({ 'sec-fetch-site': 'same-origin' }), true);
  assert.equal(isSameOrigin({ 'sec-fetch-site': ['same-origin'] }), true);
  assert.equal(isSameOrigin({ 'sec-fetch-site': 'cross-site' }), false);
  assert.equal(isSameOrigin({ 'sec-fetch-site': 'none' }), false);
  assert.equal(isSameOrigin({}), false);
});

test('allow(): off = anything; on = same-origin or the exact token', async () => {
  const dir = await tmp();
  const p = new Pairing(dir);
  await p.load();
  const res = await p.pair(p.status(true, true).code!);
  assert.ok(res.ok);
  const token = res.ok ? res.token : '';

  assert.equal(p.allow(false, false, undefined), true, 'disabled: no token needed');
  assert.equal(p.allow(true, true, undefined), true, 'first-party UI (same-origin) allowed');
  assert.equal(p.allow(true, false, token), true, 'cross-site with the token allowed');
  assert.equal(p.allow(true, false, 'wrong'), false);
  assert.equal(p.allow(true, false, undefined), false);
  await fs.rm(dir, { recursive: true, force: true });
});

test('pair(): wrong code rejected; correct code returns the token and rotates the code', async () => {
  const dir = await tmp();
  const p = new Pairing(dir);
  await p.load();
  const code = p.status(true, true).code!;
  assert.match(code, /^\d{6}$/);
  const bad = await p.pair(code === '000000' ? '111111' : '000000');
  assert.equal(bad.ok, false);
  assert.match(bad.ok ? '' : bad.error, /pairing code is wrong/i);
  const ok = await p.pair(code);
  assert.ok(ok.ok && ok.token.length > 10);
  assert.equal(p.status(true, false).paired, true);
  assert.equal((await p.pair(code)).ok, false, 'the code is single-use');
  await fs.rm(dir, { recursive: true, force: true });
});

test('status(): code only when the caller is the first-party UI', async () => {
  const dir = await tmp();
  const p = new Pairing(dir);
  await p.load();
  assert.equal(p.status(true, false).code, null, 'cross-site callers never get the code');
  assert.match(p.status(true, true).code!, /^\d{6}$/, 'the UI gets the code');
  assert.equal(p.status(false, true).required, false);
  await fs.rm(dir, { recursive: true, force: true });
});

test('token persists across restart; reset() rotates it and unpairs', async () => {
  const dir = await tmp();
  const a = new Pairing(dir);
  await a.load();
  const t1 = await a.pair(a.status(true, true).code!);
  assert.ok(t1.ok);
  const tokenA = t1.ok ? t1.token : '';
  const b = new Pairing(dir);
  await b.load();
  assert.equal(b.status(true, false).paired, true);
  assert.equal(b.allow(true, false, tokenA), true, 'the stored token still works after restart');
  await b.reset();
  assert.equal(b.status(true, false).paired, false);
  assert.equal(b.allow(true, false, tokenA), false);
  await fs.rm(dir, { recursive: true, force: true });
});

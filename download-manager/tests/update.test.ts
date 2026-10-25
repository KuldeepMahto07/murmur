import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVersion, compareVersions, isNewer } from '../engine/update.ts';

test('parseVersion pads to three parts and splits the pre-release', () => {
  assert.deepEqual(parseVersion('1.2'), { parts: [1, 2, 0], pre: [] });
  assert.deepEqual(parseVersion('v0.4.1'), { parts: [0, 4, 1], pre: [] });
  assert.deepEqual(parseVersion('2.0.0-beta.3'), { parts: [2, 0, 0], pre: ['beta', '3'] });
});

test('compareVersions orders by numeric parts', () => {
  assert.equal(compareVersions('1.0.0', '0.9.9'), 1);
  assert.equal(compareVersions('0.4.1', '0.4.2'), -1);
  assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
  assert.equal(compareVersions('0.10.0', '0.9.0'), 1); // not string order
});

test('a release outranks its pre-releases', () => {
  assert.equal(compareVersions('1.0.0', '1.0.0-rc.1'), 1);
  assert.equal(compareVersions('1.0.0-beta.1', '1.0.0-beta.2'), -1);
  assert.equal(compareVersions('1.0.0-beta.2', '1.0.0-beta.10'), -1); // numeric pre-release parts
});

test('isNewer only reports a strictly greater version', () => {
  assert.equal(isNewer('0.5.0', '0.4.1'), true);
  assert.equal(isNewer('0.4.1', '0.4.1'), false);
  assert.equal(isNewer('0.4.0', '0.4.1'), false);
  assert.equal(isNewer('v0.5.0', '0.4.1'), true); // tolerates a leading v
});

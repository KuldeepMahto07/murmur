import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LICENSE_PUBLIC_KEY } from './license-key.ts';

/*
 * Harbor Pro licensing: offline Ed25519-signed keys, no account, no phone-home.
 *
 *   key = "FL1-" + base64url(JSON payload) + "." + base64url(Ed25519 signature over those payload bytes)
 *
 * The engine only holds the public key (license-key.ts). Keys are issued with
 * scripts/license-tool.ts using a private key kept outside the repository.
 */

export const TRIAL_DAYS = 14;
export const FREE_MAX_CONNECTIONS = 8;
export const PRO_MAX_CONNECTIONS = 32;

export interface LicensePayload {
  v: 1;
  id: string;
  email: string;
  plan: 'pro-lifetime' | 'pro-yearly';
  seats: number;
  issued: string; // YYYY-MM-DD
  expires: string | null; // YYYY-MM-DD (end of day, UTC) or null for lifetime
}

export type LicenseCheck = { ok: true; payload: LicensePayload } | { ok: false; error: string };

const b64u = (b: Buffer) => b.toString('base64url');

function publicKeyObject(b64: string) {
  return crypto.createPublicKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'spki' });
}

/** Signs a payload into a key (vendor side: scripts/license-tool.ts, and tests). */
export function signKey(payload: LicensePayload, privateKeyPem: string): string {
  const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = crypto.sign(null, bytes, crypto.createPrivateKey(privateKeyPem));
  return `FL1-${b64u(bytes)}.${b64u(sig)}`;
}

/** Verifies a key's signature, format and expiry. */
export function checkKey(key: string, publicKeyB64 = LICENSE_PUBLIC_KEY, now = Date.now()): LicenseCheck {
  if (!publicKeyB64) return { ok: false, error: 'This build has no licence public key' };
  const clean = String(key ?? '').replace(/\s+/g, '');
  const m = /^FL1-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(clean);
  if (!m) return { ok: false, error: 'Not a Harbor licence key (it should start with FL1-)' };
  const bytes = Buffer.from(m[1], 'base64url');
  const sig = Buffer.from(m[2], 'base64url');
  // Only the canonical encoding is accepted, so one licence has exactly one valid key string.
  if (b64u(bytes) !== m[1] || b64u(sig) !== m[2]) return { ok: false, error: 'Licence key is damaged' };
  let valid = false;
  try {
    valid = crypto.verify(null, bytes, publicKeyObject(publicKeyB64), sig);
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, error: 'Licence key signature is not valid' };
  let p: LicensePayload;
  try {
    p = JSON.parse(bytes.toString('utf8'));
  } catch {
    return { ok: false, error: 'Licence key is damaged' };
  }
  if (p.v !== 1 || !p.email || !p.plan) return { ok: false, error: 'Unsupported licence key version' };
  if (p.expires && now > Date.parse(p.expires + 'T23:59:59Z')) return { ok: false, error: `Licence expired on ${p.expires}` };
  return { ok: true, payload: p };
}

export interface LicenseStatus {
  tier: 'free' | 'trial' | 'pro';
  pro: boolean;
  email?: string;
  plan?: string;
  expires?: string | null;
  trialDaysLeft?: number;
  trialAvailable: boolean;
  error?: string;
  maxConnections: number;
}

/** Licence state for one data folder (data/license.json). */
export class Licensing {
  private file: string;
  private state: { key?: string; trialStartedAt?: number } = {};
  private publicKey: string;
  now: () => number = Date.now;

  constructor(dataDir: string, publicKeyB64 = LICENSE_PUBLIC_KEY) {
    this.file = path.join(dataDir, 'license.json');
    this.publicKey = publicKeyB64;
  }

  async load() {
    try {
      this.state = JSON.parse(await fs.readFile(this.file, 'utf8'));
    } catch {
      this.state = {};
    }
  }

  private async save() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file + '.tmp', JSON.stringify(this.state, null, 2));
    await fs.rename(this.file + '.tmp', this.file);
  }

  status(): LicenseStatus {
    const now = this.now();
    if (this.state.key) {
      const c = checkKey(this.state.key, this.publicKey, now);
      if (c.ok) {
        const p = c.payload;
        return { tier: 'pro', pro: true, email: p.email, plan: p.plan, expires: p.expires, trialAvailable: false, maxConnections: PRO_MAX_CONNECTIONS };
      }
      // Fall through to trial/free, but say why the stored key no longer counts (e.g. a yearly key expired).
      const base = this.trialOrFree(now);
      return { ...base, error: c.error };
    }
    return this.trialOrFree(now);
  }

  private trialOrFree(now: number): LicenseStatus {
    const started = this.state.trialStartedAt;
    if (started) {
      const left = Math.ceil((started + TRIAL_DAYS * 86_400_000 - now) / 86_400_000);
      if (left > 0) return { tier: 'trial', pro: true, trialDaysLeft: left, trialAvailable: false, maxConnections: PRO_MAX_CONNECTIONS };
      return { tier: 'free', pro: false, trialDaysLeft: 0, trialAvailable: false, maxConnections: FREE_MAX_CONNECTIONS };
    }
    return { tier: 'free', pro: false, trialAvailable: true, maxConnections: FREE_MAX_CONNECTIONS };
  }

  get pro() {
    return this.status().pro;
  }

  async activate(key: string) {
    const c = checkKey(key, this.publicKey, this.now());
    if (!c.ok) throw new Error(c.error);
    this.state.key = String(key).replace(/\s+/g, '');
    await this.save();
    return this.status();
  }

  async deactivate() {
    delete this.state.key;
    await this.save();
    return this.status();
  }

  async startTrial() {
    if (this.state.trialStartedAt) throw new Error('The free trial has already been used on this PC');
    this.state.trialStartedAt = this.now();
    await this.save();
    return this.status();
  }
}

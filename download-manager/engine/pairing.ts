import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

/*
 * Browser pairing (Authentication). The engine already blocks web pages (loopback bind,
 * X-Fetchline header forcing a never-granted CORS preflight, loopback Host check). This adds
 * a secret token so that, when the user turns pairing on, OTHER local programs cannot drive
 * the engine either: a mutating API call must either be first-party (the app's own UI, proven
 * by the browser-set Sec-Fetch-Site: same-origin header) or carry the pairing token.
 *
 * The extension gets the token once by entering a short code the user reads from the app.
 * Threat model: this is defense in depth between same-user local processes, not a hard
 * boundary — a program the user runs as themselves can still read the token file. It stops
 * casual cross-program access and all web-page access.
 */

export interface PairingPublic {
  required: boolean; // is the token enforced for cross-site callers?
  paired: boolean; // has at least one extension paired?
  code: string | null; // the current pairing code (only returned to the first-party UI)
}

export class Pairing {
  private file: string;
  private token = '';
  private code = '';
  private pairedAt: number | null = null;
  now: () => number = Date.now;

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'pairing.json');
  }

  async load() {
    try {
      const s = JSON.parse(await fs.readFile(this.file, 'utf8'));
      this.token = s.token || '';
      this.pairedAt = s.pairedAt ?? null;
    } catch {}
    if (!this.token) this.token = crypto.randomBytes(24).toString('base64url');
    this.rollCode(); // a fresh code each run; pairing exchanges it for the long-lived token
    await this.save();
  }

  private rollCode() {
    this.code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private async save() {
    try {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file, JSON.stringify({ token: this.token, pairedAt: this.pairedAt }, null, 2), { mode: 0o600 });
      if (process.platform === 'win32' && process.env.USERNAME) {
        execFileSync('icacls', [this.file, '/inheritance:r', '/grant:r', `${process.env.USERNAME}:F`], { stdio: 'ignore' });
      }
    } catch {}
  }

  /** Mutating-call authorization: first-party UI (same-origin) or the right token. */
  allow(required: boolean, sameOrigin: boolean, token: string | undefined) {
    if (!required) return true;
    if (sameOrigin) return true;
    return !!token && token === this.token;
  }

  /** Exchange the displayed code for the long-lived token. */
  async pair(code: string) {
    if (!code || String(code).trim() !== this.code) return { ok: false as const, error: 'That pairing code is wrong. Open Harbor → Settings → Browser pairing for the current code.' };
    this.pairedAt = this.now();
    this.rollCode(); // the code is single-use
    await this.save();
    return { ok: true as const, token: this.token };
  }

  /** Forget pairings and rotate the token, so paired extensions must pair again. */
  async reset() {
    this.token = crypto.randomBytes(24).toString('base64url');
    this.pairedAt = null;
    this.rollCode();
    await this.save();
  }

  /** `code` is included only for the first-party UI (never for other callers). */
  status(required: boolean, includeCode: boolean): PairingPublic {
    return { required, paired: this.pairedAt != null, code: includeCode ? this.code : null };
  }
}

/** True when the browser marked the request as coming from the engine's own page. */
export function isSameOrigin(headers: Record<string, string | string[] | undefined>): boolean {
  const s = headers['sec-fetch-site'];
  return (Array.isArray(s) ? s[0] : s) === 'same-origin';
}

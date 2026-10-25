import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Checks GitHub Releases for a newer Harbor and exposes the result in the snapshot.
 * The check is a single anonymous GET to the public Releases API — no identifiers,
 * cookies or usage data are sent, ever. It is on by default and can be turned off
 * in Settings. The owner sets the repo (below or via HARBOR_RELEASES_REPO) once
 * the public repository exists; until then the check simply reports "up to date".
 */

const REPO = process.env.HARBOR_RELEASES_REPO || 'KuldeepMahto07/harbor';
/** Release tags look like "v0.5.0"; the release script uses the same prefix. */
const TAG_PREFIX = 'v';
const CHECK_MS = 24 * 60 * 60 * 1000;
/** Don't hammer the API if the engine restarts a lot: skip a check within this window. */
const MIN_GAP_MS = 60 * 60 * 1000;

export interface UpdateState {
  current: string;
  latest: string | null;
  url: string | null;
  available: boolean;
  checkedAt: number | null;
  error?: string;
}

/** Numeric release parts plus an optional pre-release tag, e.g. "1.2.3-beta.1". */
export function parseVersion(v: string): { parts: number[]; pre: string[] } {
  const m = String(v).trim().replace(/^v/i, '');
  const [core, pre = ''] = m.split('-', 2);
  const parts = core.split('.').map((n) => Number(n) || 0);
  while (parts.length < 3) parts.push(0);
  return { parts, pre: pre ? pre.split('.') : [] };
}

/** >0 if a is newer than b, <0 if older, 0 if equal. A release outranks its pre-releases. */
export function compareVersions(a: string, b: string): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  for (let i = 0; i < Math.max(va.parts.length, vb.parts.length); i++) {
    const d = (va.parts[i] ?? 0) - (vb.parts[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  // No pre-release ranks above any pre-release of the same version (1.0.0 > 1.0.0-rc.1).
  if (!va.pre.length && vb.pre.length) return 1;
  if (va.pre.length && !vb.pre.length) return -1;
  for (let i = 0; i < Math.max(va.pre.length, vb.pre.length); i++) {
    const x = va.pre[i];
    const y = vb.pre[i];
    if (x === y) continue;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = Number(x);
    const ny = Number(y);
    const bothNum = !Number.isNaN(nx) && !Number.isNaN(ny);
    const d = bothNum ? nx - ny : x < y ? -1 : 1;
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function isNewer(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0;
}

/** Reads this build's version from package.json (falls back to 0.0.0 if unreadable). */
export function appVersion(): string {
  try {
    const pkg = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    return JSON.parse(readFileSync(pkg, 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export class Updater {
  state: UpdateState;
  private enabled: () => boolean;
  private timer?: NodeJS.Timeout;

  constructor(current: string, enabled: () => boolean) {
    this.enabled = enabled;
    this.state = { current, latest: null, url: null, available: false, checkedAt: null };
  }

  start() {
    this.check();
    this.timer = setInterval(() => this.check(), CHECK_MS);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Called when the user re-enables the setting, so they don't wait a day for the first check. */
  refresh() {
    this.check(true);
  }

  async check(force = false) {
    if (!this.enabled()) return;
    if (!force && this.state.checkedAt && Date.now() - this.state.checkedAt < MIN_GAP_MS) return;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { accept: 'application/vnd.github+json', 'user-agent': `Harbor/${this.state.current}` },
        signal: ctrl.signal,
      }).finally(() => clearTimeout(t));
      if (res.status === 404) {
        // No releases yet (or the repo isn't public) — treat as up to date, quietly.
        this.state = { ...this.state, latest: null, url: null, available: false, checkedAt: Date.now(), error: undefined };
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { tag_name?: string; html_url?: string; draft?: boolean; prerelease?: boolean };
      const latest = (json.tag_name ?? '').replace(new RegExp(`^${TAG_PREFIX}`, 'i'), '');
      const available = !!latest && !json.draft && isNewer(latest, this.state.current);
      this.state = {
        current: this.state.current,
        latest: latest || null,
        url: json.html_url ?? `https://github.com/${REPO}/releases/latest`,
        available,
        checkedAt: Date.now(),
        error: undefined,
      };
    } catch (e) {
      this.state = { ...this.state, checkedAt: Date.now(), error: (e as Error).name === 'AbortError' ? 'timed out' : (e as Error).message };
    }
  }
}

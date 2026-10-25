import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { Manager } from './manager.ts';
import { probeMedia, findFfmpeg } from './hls.ts';
import { probeYtdlp, ytdlpInfo } from './ytdlp.ts';
import { isSameOrigin } from './pairing.ts';

const UI_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ui');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/**
 * Local control API. Bound to loopback only; mutating calls need the custom
 * X-Fetchline header (forces a CORS preflight we never grant) and a loopback
 * Host header (blocks DNS rebinding), so web pages cannot drive it.
 */
export function createServer(mgr: Manager, port: number) {
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);

  return http.createServer(async (req, res) => {
    try {
      if (!allowedHosts.has(req.headers.host ?? '')) return send(res, 403, { error: 'Bad host' });
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
      const parts = url.pathname.split('/').filter(Boolean);

      if (parts[0] !== 'api') return serveStatic(res, url.pathname);
      if (req.method !== 'GET' && req.headers['x-fetchline'] !== '1') return send(res, 403, { error: 'Missing X-Fetchline header' });

      const body = req.method === 'POST' || req.method === 'PUT' ? await readJson(req) : {};
      const route = `${req.method} /${parts.slice(1).join('/')}`;
      const client = req.headers['x-fetchline-client'];
      if (typeof client === 'string' && client.startsWith('extension/')) mgr.extensionSeen = { at: Date.now(), client: client.slice(0, 40) };
      const id = parts[2];

      // Pairing gate: when enabled, a mutating call must be first-party (the app's own UI,
      // proven by the browser's same-origin marker) or carry the pairing token. Pairing itself
      // and shutdown (called by the tray/installer helpers) are exempt.
      const exemptFromPairing = route === 'POST /pair' || route === 'POST /shutdown';
      if (req.method !== 'GET' && !exemptFromPairing) {
        const ok = mgr.pairing.allow(!!mgr.settings.requirePairing, isSameOrigin(req.headers), req.headers['x-harbor-token'] as string | undefined);
        if (!ok) return send(res, 403, { error: 'This browser needs to be paired with Harbor. Open Harbor → Settings → Browser pairing for a code.', needPair: true });
      }

      switch (true) {
        case route === 'GET /state':
          return send(res, 200, mgr.snapshot());
        case route === 'GET /events':
          return events(req, res, mgr);
        case route === 'POST /downloads':
          console.log(`${new Date().toISOString()} add ${body.kind ?? "file"} ${body.url}`);
          return send(res, 201, mgr.add(body));
        case route === `GET /downloads/${id}`:
          return send(res, 200, mgr.get(id));
        case route === `POST /downloads/${id}/resume`:
          mgr.resume(id);
          return send(res, 200, { ok: true });
        case route === `POST /downloads/${id}/pause`:
          await mgr.pause(id);
          return send(res, 200, { ok: true });
        case route === `POST /downloads/${id}/redownload`:
          await mgr.redownload(id);
          return send(res, 200, { ok: true });
        case route === `PUT /downloads/${id}`:
          mgr.update(id, body);
          return send(res, 200, mgr.get(id));
        case route === `DELETE /downloads/${id}`:
          await mgr.remove(id, url.searchParams.get('deleteFile') === '1');
          return send(res, 200, { ok: true });
        case route === 'POST /update/check':
          await mgr.updater.check(true);
          return send(res, 200, mgr.updater.state);
        case route === 'GET /diagnostics':
          return send(res, 200, { text: await buildDiagnostics(mgr) });
        case route === 'GET /license':
          return send(res, 200, mgr.licensing.status());
        case route === 'PUT /license':
          return send(res, 200, await mgr.activateLicense(String(body.key ?? '')));
        case route === 'DELETE /license':
          return send(res, 200, await mgr.deactivateLicense());
        case route === 'POST /license/trial':
          return send(res, 200, await mgr.startTrial());
        case route === 'GET /startup':
          return send(res, 200, { supported: process.platform === 'win32', on: existsSync(STARTUP_LINK) });
        case route === 'PUT /startup':
          if (process.platform !== 'win32') return send(res, 400, { error: 'Start with Windows is only available on Windows' });
          await setStartup(!!body.on);
          return send(res, 200, { supported: true, on: existsSync(STARTUP_LINK) });
        case route === 'GET /ping':
          return send(res, 200, { app: 'fetchline', version: 1, ytdlp: (await ytdlpInfo())?.version ?? null });
        case route === 'GET /pairing/status':
          // The 6-digit code is returned only to the app's own UI (same-origin), never to others.
          return send(res, 200, mgr.pairing.status(!!mgr.settings.requirePairing, isSameOrigin(req.headers)));
        case route === 'POST /pair': {
          const r = await mgr.pairing.pair(String(body.code ?? ''));
          return send(res, r.ok ? 200 : 403, r);
        }
        case route === 'POST /pairing/reset':
          await mgr.pairing.reset();
          return send(res, 200, mgr.pairing.status(!!mgr.settings.requirePairing, isSameOrigin(req.headers)));
        case route === 'POST /ytdlp/probe': {
          const t0 = Date.now();
          try {
            const r = await probeYtdlp(String(body.url), body.cookies, mgr.dataDir);
            console.log(`${new Date().toISOString()} yt-dlp probe ok ${Date.now() - t0}ms ${r.choices.length} choices: ${body.url}`);
            return send(res, 200, r);
          } catch (e) {
            console.log(`${new Date().toISOString()} yt-dlp probe FAILED ${Date.now() - t0}ms (${(body.cookies ?? []).length} cookies): ${body.url}: ${(e as Error).message}`);
            throw e;
          }
        }
        case route === 'POST /media/probe':
          return send(res, 200, await probeMedia(String(body.url), body.headers));
        case route === 'POST /pause-all':
          await mgr.pauseAll();
          return send(res, 200, { ok: true });
        case route === 'POST /queue/start':
          mgr.startQueue(false);
          return send(res, 200, { ok: true });
        case route === 'POST /queue/stop':
          await mgr.stopQueue();
          return send(res, 200, { ok: true });
        case route === 'PUT /settings':
          mgr.updateSettings(body);
          return send(res, 200, mgr.settings);
        case route === 'POST /shutdown':
          send(res, 200, { ok: true });
          return mgr.onExit();
        default:
          return send(res, 404, { error: 'Not found' });
      }
    } catch (e) {
      send(res, 400, { error: (e as Error).message });
    }
  });
}

const STARTUP_LINK = path.join(process.env.APPDATA ?? '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'Harbor.lnk');

/** Creates/removes the Startup shortcut through the tray script (one implementation for tray and UI). */
function setStartup(on: boolean) {
  const tray = path.join(UI_DIR, '..', 'desktop', 'tray.ps1');
  return new Promise<void>((resolve, reject) => {
    const p = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tray, '-Action', on ? 'enable-startup' : 'disable-startup'], { windowsHide: true, stdio: 'ignore' });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`startup toggle failed (${code})`))));
  });
}

/**
 * A support report the user can paste into a bug report. Privacy-first: versions,
 * counts and settings only — never URLs, file names, folders, keys or the e-mail.
 * The video helper is named neutrally (the tool's name is not shown in the app).
 */
/** Strips URLs, hosts and paths from an error message so it can go in a bug report. */
export function redactError(msg: string): string {
  return msg
    .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s'"<>]+/gi, '<url>')
    .replace(/(?:[a-z]:)?(?:[\\/][^\\/\s'"<>]+){2,}[\\/]?/gi, '<path>')
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi, '<host>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/** The five most common (redacted) error messages, e.g. "HTTP 403 ×3 · ECONNRESET ×1". */
export function errorSummary(messages: (string | undefined)[]): string {
  const n = new Map<string, number>();
  for (const m of messages) if (m) n.set(redactError(m), (n.get(redactError(m)) ?? 0) + 1);
  if (!n.size) return 'none';
  return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m, c]) => `${m} ×${c}`).join(' · ');
}

async function buildDiagnostics(mgr: Manager): Promise<string> {
  const u = mgr.updater.state;
  const lic = mgr.licensing.status();
  const [yt, ffmpeg] = await Promise.all([ytdlpInfo().catch(() => null), findFfmpeg().catch(() => null)]);

  const byStatus = new Map<string, number>();
  for (const r of mgr.records.values()) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
  const counts = [...byStatus.entries()].map(([k, n]) => `${n} ${k}`).join(' · ') || 'none';
  const errors = errorSummary([...mgr.records.values()].map((r) => (r.status === 'error' ? r.error : undefined)));

  const update = u.error
    ? `last check failed (${u.error})`
    : !mgr.settings.updateCheck && mgr.settings.updateCheck !== undefined
      ? 'checks off'
      : u.available
        ? `${u.latest} available`
        : u.checkedAt
          ? 'up to date'
          : 'not checked yet';
  const license =
    lic.tier === 'pro' ? `Pro${lic.plan === 'pro-yearly' ? ' (yearly)' : ' (lifetime)'}` : lic.tier === 'trial' ? `Trial (${lic.trialDaysLeft} days left)` : 'Free';
  const s = mgr.settings;

  return [
    `Harbor ${u.current} diagnostics`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `App:        ${u.current} (${process.platform}, ${process.arch})`,
    `Runtime:    Node ${process.version}`,
    `Video help: ${yt ? `present (${yt.version})` : 'not installed'} · ffmpeg ${ffmpeg ? 'present' : 'not found'}`,
    `Update:     ${update}`,
    `License:    ${license}`,
    `Downloads:  ${mgr.records.size} total — ${counts}`,
    `Errors:     ${errors}`,
    `Settings:   ${s.connections} connections, ${s.maxConcurrent} concurrent, speed limit ${s.globalSpeedLimit ? Math.round(s.globalSpeedLimit / 1024) + ' KB/s' : 'none'}`,
    `Pairing:    ${s.requirePairing ? 'required' : 'off'}${mgr.extensionSeen ? ' · extension connected' : ''}`,
    ``,
    `This report contains no URLs, file names or folders.`,
  ].join('\n');
}

function events(req: http.IncomingMessage, res: http.ServerResponse, mgr: Manager) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
  const push = () => res.write(`data: ${JSON.stringify(mgr.snapshot())}\n\n`);
  push();
  const off = mgr.subscribe(push);
  req.on('close', off);
}

async function serveStatic(res: http.ServerResponse, pathname: string) {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.normalize(path.join(UI_DIR, rel));
  if (!file.startsWith(UI_DIR)) return send(res, 404, { error: 'Not found' });
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch {
    send(res, 404, { error: 'Not found' });
  }
}

function send(res: http.ServerResponse, status: number, data: unknown) {
  if (res.headersSent) return;
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data, (_k, v) => (v === Number.MAX_SAFE_INTEGER ? null : v)));
}

async function readJson(req: http.IncomingMessage) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error('Body too large');
  }
  return raw ? JSON.parse(raw) : {};
}

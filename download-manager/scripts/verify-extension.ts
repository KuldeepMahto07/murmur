/**
 * End-to-end test of the browser extension's video button.
 *
 * Builds a local test site (an MP4 in a <video>, a multi-quality HLS stream where
 * one quality has separate audio, and an AES-encrypted playlist), loads the
 * unpacked extension into headless Edge/Chrome, then over the DevTools protocol:
 * hovers the video → checks the floating button → opens the menu → checks the
 * entries → sends the MP4 and two HLS qualities to a real engine process and
 * verifies the files (hash for the MP4, ffprobe streams/duration for HLS).
 *
 *   node scripts/verify-extension.ts [--browser "C:\path\to\msedge.exe"]
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = path.join(ROOT, 'extension');
const WORK = path.join(ROOT, 'data', 'verify-ext');
const SITE = path.join(ROOT, 'data', 'ext-test-site');
const ENGINE_PORT = 8792;
const CDP_PORT = 9334;
const argBrowser = process.argv.indexOf('--browser');
/** --real-abdm: relay the extension's calls to the installed AB Download Manager (port 15151) and download through it. */
const REAL_ABDM = process.argv.includes('--real-abdm');
const ABDM_REAL_PORT = 15151;
const BROWSER =
  argBrowser > 0
    ? process.argv[argBrowser + 1]
    : ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(existsSync)!;

let failures = 0;
function check(ok: boolean, what: string) {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${what}`);
  if (!ok) failures++;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ fixtures

function ff(...args: string[]) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
}

async function buildSite() {
  if (existsSync(path.join(SITE, 'index.html'))) return;
  console.log('building test site with ffmpeg…');
  for (const d of ['media', 'hls/v360', 'hls/v240', 'hls/v480', 'hls/audio', 'enc']) await fs.mkdir(path.join(SITE, d), { recursive: true });
  const clip = path.join(SITE, 'media', 'clip.mp4');
  ff('-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100', '-t', '20',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '50', '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', clip);
  const hls = (out: string, ...enc: string[]) =>
    ff('-i', clip, ...enc, '-f', 'hls', '-hls_time', '2', '-hls_playlist_type', 'vod', '-hls_segment_filename', path.join(SITE, 'hls', out, 'seg_%03d.ts'), path.join(SITE, 'hls', out, 'index.m3u8'));
  hls('v360', '-c', 'copy');
  hls('v240', '-vf', 'scale=426:240', '-c:v', 'libx264', '-g', '50', '-c:a', 'aac');
  hls('v480', '-vf', 'scale=854:480', '-an', '-c:v', 'libx264', '-g', '50'); // video only
  hls('audio', '-vn', '-c:a', 'aac'); // separate audio rendition
  await fs.writeFile(
    path.join(SITE, 'hls', 'master.m3u8'),
    [
      '#EXTM3U',
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="English",DEFAULT=YES,AUTOSELECT=YES,URI="audio/index.m3u8"',
      '#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=854x480,AUDIO="aud"',
      'v480/index.m3u8',
      '#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360',
      'v360/index.m3u8',
      '#EXT-X-STREAM-INF:BANDWIDTH=450000,RESOLUTION=426x240',
      'v240/index.m3u8',
      '',
    ].join('\n'),
  );
  await fs.writeFile(
    path.join(SITE, 'enc', 'index.m3u8'),
    '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:2.0,\nseg0.ts\n#EXT-X-ENDLIST\n',
  );
  await fs.writeFile(
    path.join(SITE, 'index.html'),
    `<!doctype html><html><head><meta charset="utf-8"><title>Fetchline Test Clip</title></head>
<body style="font-family:sans-serif;background:#222;color:#eee;margin:24px">
<h1>Test page</h1>
<video id="v1" src="media/clip.mp4" width="640" height="360" controls muted autoplay loop></video>
<p>A second player loads an HLS stream the way JavaScript players do (fetching playlists):</p>
<div id="v2box" style="width:640px;height:360px;background:#000"></div>
<script>
  fetch('hls/master.m3u8').then(r => r.text()).then(() => fetch('hls/v360/index.m3u8'));
  fetch('enc/index.m3u8');
</script>
</body></html>`,
  );
}

const MIME: Record<string, string> = { '.html': 'text/html', '.mp4': 'video/mp4', '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t' };

function serveSite() {
  const server = http.createServer(async (req, res) => {
    const rel = decodeURIComponent(new URL(req.url!, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(SITE, rel));
    if (!file.startsWith(SITE)) return res.writeHead(403).end();
    let data: Buffer;
    try {
      data = await fs.readFile(file);
    } catch {
      return res.writeHead(404).end();
    }
    const type = MIME[path.extname(file)] ?? 'application/octet-stream';
    const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
    if (m) {
      const start = +m[1];
      const end = m[2] ? Math.min(+m[2], data.length - 1) : data.length - 1;
      res.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${data.length}`, 'content-length': end - start + 1 });
      return res.end(data.subarray(start, end + 1));
    }
    res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': data.length });
    res.end(data);
  });
  return new Promise<http.Server>((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

// ----------------------------------------------------------------- CDP client

class Cdp {
  private ws: WebSocket;
  private id = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private handlers: ((m: any) => void)[] = [];
  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.onmessage = (e) => {
      const msg = JSON.parse(String(e.data));
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      } else for (const h of this.handlers) h(msg);
    };
  }
  static connect(url: string) {
    return new Promise<Cdp>((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.onopen = () => resolve(new Cdp(ws));
      ws.onerror = () => reject(new Error('CDP connect failed'));
    });
  }
  send(method: string, params: object = {}, sessionId?: string): Promise<any> {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(h: (m: any) => void) {
    this.handlers.push(h);
  }
  close() {
    this.ws.close();
  }
}

// --------------------------------------------------------------------- engine

async function engineApi(method: string, p: string, body?: unknown) {
  const res = await fetch(`http://127.0.0.1:${ENGINE_PORT}/api${p}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-fetchline': '1' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

function ffprobe(file: string) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,height:format=duration', '-of', 'json', file]).toString();
  const j = JSON.parse(out);
  return {
    video: j.streams.find((s: any) => s.codec_type === 'video'),
    audio: j.streams.some((s: any) => s.codec_type === 'audio'),
    duration: Number(j.format.duration),
  };
}

// ----------------------------------------------------------------------- main

let engine: ChildProcess | undefined;
let browser: ChildProcess | undefined;
let site: http.Server | undefined;

try {
  await buildSite();
  site = await serveSite();
  const siteUrl = `http://127.0.0.1:${(site.address() as any).port}/`;

  await fs.rm(WORK, { recursive: true, force: true });
  await fs.mkdir(WORK, { recursive: true });
  engine = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(ROOT, 'engine', 'main.ts'), '--port', String(ENGINE_PORT), '--data', WORK], { stdio: 'ignore' });

  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'fetchline-ext-'));
  browser = spawn(BROWSER, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    `--load-extension=${EXT}`, `--disable-extensions-except=${EXT}`,
    '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', '--window-size=1280,900', 'about:blank',
  ], { stdio: 'ignore' });

  let wsUrl = '';
  for (let i = 0; i < 100 && !wsUrl; i++) {
    try {
      wsUrl = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json()).webSocketDebuggerUrl;
    } catch {
      await sleep(200);
    }
  }
  if (!wsUrl) throw new Error('browser did not expose DevTools');
  const cdp = await Cdp.connect(wsUrl);

  // Point the extension at the test engine port (its service worker owns chrome.storage).
  // The browser runs other (built-in) extension workers too; find ours by manifest name.
  let swSession = '';
  for (let i = 0; i < 50 && !swSession; i++) {
    const { targetInfos } = await cdp.send('Target.getTargets');
    for (const t of targetInfos.filter((t: any) => t.type === 'service_worker' && t.url.startsWith('chrome-extension://'))) {
      const sid = (await cdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: true })).sessionId;
      const r = await cdp.send('Runtime.evaluate', { expression: 'chrome.runtime.getManifest().name', returnByValue: true }, sid);
      if (r.result?.value === 'Fetchline Integration') {
        swSession = sid;
        break;
      }
      await cdp.send('Target.detachFromTarget', { sessionId: sid });
    }
    if (!swSession) await sleep(200);
  }
  check(!!swSession, 'extension loaded (service worker running)');
  if (!swSession) throw new Error('extension did not load — this browser build may not allow --load-extension');
  cdp.on((m) => {
    if (m.sessionId === swSession && m.method === 'Runtime.consoleAPICalled')
      console.log('        [sw]', m.params.args.map((a: any) => a.value ?? a.description).join(' '));
  });
  await cdp.send('Runtime.enable', {}, swSession);
  await cdp.send('Runtime.evaluate', { expression: `chrome.storage.local.set({ port: ${ENGINE_PORT} })`, awaitPromise: true }, swSession);
  for (let i = 0; i < 50; i++) {
    if (await engineApi('GET', '/ping').catch(() => null)) break;
    await sleep(200);
  }
  const ping = await cdp.send(
    'Runtime.evaluate',
    { expression: `fetch('http://127.0.0.1:${ENGINE_PORT}/api/ping').then(r => r.status + ' ' + r.statusText).catch(e => 'ERR ' + e)`, awaitPromise: true, returnByValue: true },
    swSession,
  );
  check(String(ping.result.value).startsWith('200'), `extension can reach the engine (${ping.result.value})`);

  // Open the test page.
  const contexts: any[] = [];
  cdp.on((m) => m.method === 'Runtime.executionContextCreated' && contexts.push(m.params.context));
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const s = (await cdp.send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await cdp.send('Page.enable', {}, s);
  await cdp.send('Runtime.enable', {}, s);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, s);
  await cdp.send('Page.navigate', { url: siteUrl }, s);
  await sleep(3500); // let the video play and the page fetch its playlists

  const { frameTree } = await cdp.send('Page.getFrameTree', {}, s);
  const iso = () => contexts.filter((c) => c.auxData?.type === 'isolated' && c.auxData.frameId === frameTree.frame.id && c.name === 'Fetchline Integration').pop();
  const inExt = async (expr: string) => {
    const ctx = iso();
    if (!ctx) throw new Error('content script context not found');
    const r = await cdp.send('Runtime.evaluate', { expression: expr, contextId: ctx.id, returnByValue: true, awaitPromise: true }, s);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'evaluate failed');
    return r.result.value;
  };
  const inPage = async (expr: string) => (await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true }, s)).result.value;
  const mouse = async (type: string, x: number, y: number) =>
    cdp.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: type === 'mouseMoved' ? 0 : 1 }, s);
  const shot = async (name: string) => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, s);
    await fs.writeFile(path.join(WORK, name), Buffer.from(data, 'base64'));
  };

  check(!!iso(), 'content script injected into the page');
  check(await inExt(`!__fetchlineRoot.querySelector('.fab').classList.contains('on') || true`), 'overlay mounted');

  // Hover → button appears at the video's top-right.
  const v = await inPage(`(() => { const r = document.querySelector('#v1').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, right: r.right, top: r.top }; })()`);
  await mouse('mouseMoved', 10, 10);
  await sleep(1600);
  await mouse('mouseMoved', v.x, v.y);
  await sleep(400);
  const fab = await inExt(`(() => { const f = __fetchlineRoot.querySelector('.fab'); const r = f.getBoundingClientRect(); return { on: f.classList.contains('on'), x: r.left + r.width / 2, y: r.top + r.height / 2, right: r.right, top: r.top }; })()`);
  check(fab.on, 'hovering the video shows the Download button');
  check(Math.abs(fab.right - (v.right - 10)) < 4 && Math.abs(fab.top - (v.top + 10)) < 4, 'button sits at the video\u2019s top-right corner');

  // Moving away hides it.
  await mouse('mouseMoved', v.right + 200, v.top + 20);
  await sleep(1700);
  check(!(await inExt(`__fetchlineRoot.querySelector('.fab').classList.contains('on')`)), 'button hides after the pointer leaves');

  async function openMenu() {
    await mouse('mouseMoved', v.x, v.y);
    await sleep(300);
    await mouse('mouseMoved', fab.x, fab.y);
    await mouse('mousePressed', fab.x, fab.y);
    await mouse('mouseReleased', fab.x, fab.y);
    for (let i = 0; i < 40; i++) {
      const rows = await inExt(`[...__fetchlineRoot.querySelectorAll('.menu .row')].map(b => b.querySelector('.l').textContent)`);
      if (rows.length) return rows as string[];
      await sleep(150);
    }
    return [] as string[];
  }

  const rows = await openMenu();
  console.log('        menu:', rows.join(' | ') || (await inExt(`__fetchlineRoot.querySelector('.menu .note')?.textContent`)));
  await shot('overlay-menu.png');
  check(rows.some((r) => /^MP4 file/.test(r)), 'menu offers the MP4 file');
  check(['HLS 480p', 'HLS 360p', 'HLS 240p'].every((q) => rows.some((r) => r.startsWith(q))), 'menu offers all three HLS qualities from the master playlist');
  check(!rows.some((r) => r === 'HLS stream'), 'variant playlists the page fetched are folded into the master entry');
  check(rows.includes('Encrypted stream'), 'encrypted playlist is listed as blocked, not offered');

  const clickRow = async (prefix: string) => {
    const ok = await inExt(`(() => { const b = [...__fetchlineRoot.querySelectorAll('.menu .row')].find(b => b.querySelector('.l').textContent.startsWith(${JSON.stringify(prefix)})); if (!b) return false; b.click(); return true; })()`);
    await sleep(800);
    const sent = await inExt(`[...__fetchlineRoot.querySelectorAll('.menu .row.sent')].length`);
    return ok && sent > 0;
  };
  check(await clickRow('MP4 file'), 'clicking MP4 sends it to Fetchline');
  await sleep(1000);
  await openMenu();
  check(await clickRow('HLS 480p'), 'clicking HLS 480p (separate audio) sends it');
  await sleep(1000);
  await openMenu();
  check(await clickRow('HLS 360p'), 'clicking HLS 360p sends it');

  // Wait for the engine to finish all three.
  let downloads: any[] = [];
  for (let i = 0; i < 240; i++) {
    downloads = (await engineApi('GET', '/state')).downloads;
    if (downloads.length >= 3 && downloads.every((d: any) => d.status === 'completed' || d.status === 'error')) break;
    await sleep(500);
  }
  for (const d of downloads) console.log(`        ${d.status.padEnd(9)} ${d.kind?.padEnd(4)} ${d.hls?.label ?? ''} → ${d.fileName}${d.error ? ' (' + d.error + ')' : ''}`);
  check(downloads.length === 3 && downloads.every((d) => d.status === 'completed'), 'all three downloads completed in the engine');

  const mp4 = downloads.find((d) => d.kind === 'file');
  if (mp4) {
    const want = crypto.createHash('sha256').update(await fs.readFile(path.join(SITE, 'media', 'clip.mp4'))).digest('hex');
    check(mp4.checksum.sha256 === want, 'MP4 is byte-identical to the source');
    const rec = await engineApi('GET', `/downloads/${mp4.id}`);
    check(rec.headers?.referer?.startsWith(siteUrl) && !!rec.headers?.['user-agent'], 'referer and user agent were handed over from the browser');
  }
  for (const [label, height] of [['480p', 480], ['360p', 360]] as const) {
    const d = downloads.find((x) => x.hls?.label?.startsWith(label));
    if (!d) {
      check(false, `HLS ${label} download exists`);
      continue;
    }
    const info = ffprobe(path.join(d.dir, d.fileName));
    check(d.fileName.startsWith('Fetchline Test Clip') && d.fileName.endsWith('.mp4'), `HLS ${label} named from the page title (${d.fileName})`);
    check(info.video?.height === height && info.audio && Math.abs(info.duration - 20) < 1.5, `HLS ${label} is a ${height}p MP4 with audio, ${info.duration.toFixed(1)} s`);
  }

  // ---- Hand-off to AB Download Manager. By default a stand-in implements its integration API
  //      (POST /ping → "pong", POST /add {items, options} → "OK"; see its REST-API.yml / Endpoints.kt).
  //      With --real-abdm the stand-in records each call and relays it to the installed app.
  console.log(`\n  AB Download Manager hand-off${REAL_ABDM ? ' (relayed to the real app)' : ''}`);
  const received: any[] = [];
  const realReplies: string[] = [];
  const abdm = http.createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    if (req.method === 'POST' && req.url === '/add') received.push({ apiKey: req.headers['x-api-key'], ...JSON.parse(body) });
    if (REAL_ABDM) {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (req.headers['x-api-key']) headers['X-Api-Key'] = String(req.headers['x-api-key']);
      const r = await fetch(`http://127.0.0.1:${ABDM_REAL_PORT}${req.url}`, { method: req.method, headers, body }).catch(() => null);
      const text = r ? await r.text() : 'unreachable';
      if (req.url === '/add') realReplies.push(`${r?.status} ${text}`);
      return res.writeHead(r?.status ?? 502).end(text);
    }
    if (req.method === 'POST' && req.url === '/ping') return res.end('pong');
    if (req.method === 'POST' && req.url === '/add') return res.end('OK');
    res.writeHead(404).end();
  });
  await new Promise<void>((r) => abdm.listen(0, '127.0.0.1', r));
  const abdmPort = (abdm.address() as any).port;
  await cdp.send('Runtime.evaluate', { expression: `chrome.storage.local.set({ target: 'abdm', abdmPort: ${abdmPort}, abdmKey: 'k123' })`, awaitPromise: true }, swSession);
  await sleep(1500);
  const rows2 = await openMenu();
  check(rows2.some((r) => r.startsWith('HLS 360p')), 'menu still lists qualities with AB DM selected (playlist read by the extension)');
  check(await clickRow('MP4 file'), 'clicking MP4 sends it to AB DM');
  await sleep(1000);
  await openMenu();
  check(await clickRow('HLS 360p'), 'clicking HLS 360p sends it to AB DM');
  await sleep(500);
  const [a1, a2] = received;
  const i1 = a1?.items?.[0];
  const i2 = a2?.items?.[0];
  console.log('        AB DM received:', JSON.stringify(received.map((r) => ({ ...r.items[0], headers: Object.keys(r.items[0].headers ?? {}) }))));
  check(received.length === 2 && a1.apiKey === 'k123', 'AB DM got two /add calls carrying the X-Api-Key');
  check(i1?.type === 'http' && i1.link === `${siteUrl}media/clip.mp4` && i1.downloadPage === siteUrl && !!i1.headers?.['user-agent'], 'MP4 sent as type "http" with link, download page and headers');
  check(i2?.type === 'hls' && i2.link === `${siteUrl}hls/v360/index.m3u8` && i2.suggestedName === 'Fetchline Test Clip.mp4', 'HLS sent as type "hls" with the 360p media playlist and a title-based name');
  check(a1?.options?.silentAdd === false, 'AB DM is asked to show its add dialog (silentAdd false)');
  abdm.close();
  abdm.closeAllConnections();

  if (REAL_ABDM) {
    check(realReplies.length === 2 && realReplies.every((r) => r === '200 OK'), `real AB DM accepted both /add requests (${realReplies.join(', ')})`);
    // /add opens AB DM's dialog for the user. To prove its engine can fetch what the extension
    // sends, hand the very same items to /start-headless-download, which downloads without a dialog.
    const folder = path.join(WORK, 'abdm').split(path.sep).join('/');
    await fs.mkdir(folder, { recursive: true });
    const names = ['abdm-clip.mp4', 'abdm-hls-360p.mp4'];
    for (const [i, item] of [i1, i2].entries()) {
      const r = await fetch(`http://127.0.0.1:${ABDM_REAL_PORT}/start-headless-download`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ downloadSource: item, folder, name: names[i], startDownload: true }),
      });
      check(r.ok, `real AB DM started headless download of ${names[i]} (${r.status} ${await r.text()})`);
    }
    const want = crypto.createHash('sha256').update(await fs.readFile(path.join(SITE, 'media', 'clip.mp4'))).digest('hex');
    let mp4ok = false;
    let hls: ReturnType<typeof ffprobe> | null = null;
    for (let t = 0; t < 180 && !(mp4ok && hls); t++) {
      await sleep(1000);
      const f1 = path.join(folder, names[0]);
      const f2 = path.join(folder, names[1]);
      if (!mp4ok && existsSync(f1)) mp4ok = crypto.createHash('sha256').update(await fs.readFile(f1)).digest('hex') === want;
      if (!hls && existsSync(f2)) {
        try {
          const info = ffprobe(f2);
          if (Math.abs(info.duration - 20) < 1.5) hls = info;
        } catch {}
      }
    }
    console.log('        files:', (await fs.readdir(folder)).join(', '));
    check(mp4ok, 'AB DM downloaded the MP4 byte-identical to the source');
    check(!!hls && hls.video?.height === 360 && hls.audio, `AB DM downloaded the 360p HLS stream (${hls ? `${hls.video?.height}p, audio ${hls.audio}, ${hls.duration.toFixed(1)} s` : 'not finished'})`);
  }

  await cdp.send('Browser.close').catch(() => {});
  cdp.close();
} catch (e) {
  failures++;
  console.error('  ERROR ', (e as Error).message);
} finally {
  browser?.kill();
  if (engine) {
    await engineApi('POST', '/shutdown').catch(() => {});
    engine.kill();
  }
  site?.close();
  site?.closeAllConnections();
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);

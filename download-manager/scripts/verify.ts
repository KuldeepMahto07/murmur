/**
 * End-to-end check of the engine as a separate process:
 *   multi-connection download → pause → resume → hard kill → restart → complete → checksum.
 *
 *   node scripts/verify.ts            # local range server + public file
 *   node scripts/verify.ts --local    # local only (offline, deterministic)
 *   node scripts/verify.ts --public   # public file only
 *
 * The local phase also corrupts bytes on disk while the engine is dead, to prove
 * the resume overlap check notices and re-fetches that segment.
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_URL = 'https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-6.6.tar.xz';
const PUBLIC_SUMS = 'https://cdn.kernel.org/pub/linux/kernel/v6.x/sha256sums.asc';
const PORT = 8790;
const H = { 'content-type': 'application/json', 'x-fetchline': '1' };

let failures = 0;
function check(ok: boolean, what: string) {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${what}`);
  if (!ok) failures++;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MB = (n: number) => (n / 1048576).toFixed(1) + ' MB';

// ------------------------------------------------------------- engine I/O

function startEngine(dataDir: string): ChildProcess {
  const child = spawn(process.execPath, [path.join(ROOT, 'engine', 'main.ts'), '--port', String(PORT), '--data', dataDir], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr!.on('data', (d) => {
    const s = String(d);
    if (!s.includes('ExperimentalWarning') && !s.includes('--trace-warnings')) process.stderr.write('[engine] ' + s);
  });
  return child;
}

async function waitUp() {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/api/state`);
      return;
    } catch {
      await sleep(100);
    }
  }
  throw new Error('engine did not start');
}

async function api(method: string, p: string, body?: unknown) {
  const res = await fetch(`http://127.0.0.1:${PORT}/api${p}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${p}: ${data.error}`);
  return data;
}

async function getDl(id: string) {
  const s = await api('GET', '/state');
  return s.downloads.find((d: any) => d.id === id);
}

async function waitFor(id: string, pred: (d: any) => boolean, label: string, timeoutMs = 600_000) {
  const t0 = Date.now();
  let last = 0;
  let maxConns = 0;
  for (;;) {
    const d = await getDl(id);
    maxConns = Math.max(maxConns, d.activeConnections.length);
    if (Date.now() - last > 2000) {
      last = Date.now();
      console.log(`        ${label}: ${d.status} ${MB(d.downloaded)} / ${MB(d.size ?? 0)}  ${MB(d.speed)}/s  conns=${d.activeConnections.length} segs=${d.segments.length}`);
    }
    if (pred(d)) return { d, maxConns };
    if (d.status === 'error') throw new Error(`download failed: ${d.error}`);
    if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for ${label}`);
    await sleep(250);
  }
}

// ------------------------------------------------------------ the scenario

async function scenario(name: string, url: string, expectedSha: string, opts: { corrupt?: boolean; minConns: number }) {
  console.log(`\n=== ${name}`);
  const dataDir = path.join(ROOT, 'data', `verify-${name}`);
  await fs.rm(dataDir, { recursive: true, force: true });

  let engine = startEngine(dataDir);
  await waitUp();
  const t0 = Date.now();
  const rec = await api('POST', '/downloads', { url, connections: 8, checksum: `sha256:${expectedSha}`, start: 'now' });
  const id = rec.id;

  const a = await waitFor(id, (d) => d.size && d.downloaded > d.size * 0.2, 'to 20%');
  check(a.d.resumable === true, 'server supports ranges; download marked resumable');

  // Pause / resume.
  await api('POST', `/downloads/${id}/pause`);
  const p1 = await getDl(id);
  await sleep(1500);
  const p2 = await getDl(id);
  check(p1.status === 'paused' && p2.downloaded === p1.downloaded && p2.activeConnections.length === 0, `pause holds at ${MB(p1.downloaded)} with no open connections`);
  await api('POST', `/downloads/${id}/resume`);
  const b = await waitFor(id, (d) => d.downloaded > d.size * 0.55, 'to 55%');
  const maxConns = Math.max(a.maxConns, b.maxConns);
  check(maxConns >= opts.minConns, `used ${maxConns} parallel connections (want ≥ ${opts.minConns})`);
  check(b.d.segments.length > 1, `dynamic segmentation produced ${b.d.segments.length} segments`);

  // Hard kill (TerminateProcess on Windows: no shutdown handler runs).
  await sleep(1200); // let at least one checkpoint land after resuming
  const beforeKill = (await getDl(id)).downloaded;
  engine.kill('SIGKILL');
  await new Promise((r) => engine.once('exit', r));
  const saved = JSON.parse(await fs.readFile(path.join(dataDir, 'state.json'), 'utf8'));
  const srec = saved.downloads.find((d: any) => d.id === id);
  const durable = srec.segments.reduce((n: number, s: any) => n + (s.pos - s.start), 0);
  console.log(`        killed at ${MB(beforeKill)}; state file holds ${MB(durable)} as durable`);
  check(durable > srec.size * 0.4, 'state file kept progress across the kill');

  let corruptAt = -1;
  if (opts.corrupt) {
    // Flip bytes just before a resumable position; the overlap check must notice.
    const seg = srec.segments.find((s: any) => s.pos - s.start > 32768 && s.pos < s.end);
    if (seg) {
      corruptAt = seg.pos - 1000;
      const fh = await fs.open(path.join(srec.dir, `.fetchline-${id}.part`), 'r+');
      await fh.write(Buffer.alloc(64, 0xa5), 0, 64, corruptAt);
      await fh.close();
      console.log(`        corrupted 64 bytes at ${corruptAt} (segment ${seg.start}-${seg.end}, pos ${seg.pos})`);
    }
  }

  engine = startEngine(dataDir);
  await waitUp();
  const r1 = await getDl(id);
  check(r1.status === 'downloading', 'download resumed by itself after restart (crash recovery)');
  check(r1.downloaded >= durable * 0.99 - 65536 || opts.corrupt === true, `restart continued from ${MB(r1.downloaded)} instead of zero`);

  const c = await waitFor(id, (d) => d.status === 'completed', 'to finish');
  const secs = (Date.now() - t0) / 1000;
  console.log(`        finished in ${secs.toFixed(1)} s total (avg ${MB(c.d.size / secs)}/s incl. pauses)`);
  check(c.d.checksum.match === true, `engine checksum matches expected sha256 ${expectedSha.slice(0, 16)}…`);

  const file = path.join(c.d.dir, c.d.fileName);
  const own = crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
  check(own === expectedSha, `independent sha256 of ${c.d.fileName} matches`);
  if (opts.corrupt && corruptAt >= 0) {
    const full = await api('GET', `/downloads/${id}`);
    check(full.log.some((l: string) => l.includes('Resume check failed')), 'resume overlap check caught the corrupted bytes');
  }
  await fetch(`http://127.0.0.1:${PORT}/api/shutdown`, { method: 'POST', headers: H }).catch(() => {});
  await new Promise((r) => engine.once('exit', r));
}

// ------------------------------------------------- local throttled range server

function localServer(data: Buffer, bytesPerSec: number) {
  const etag = '"' + crypto.createHash('md5').update(data).digest('hex') + '"';
  const server = http.createServer(async (req, res) => {
    const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
    let start = 0;
    let end = data.length;
    if (m) {
      start = +m[1];
      end = m[2] ? +m[2] + 1 : data.length;
      if (req.headers['if-range'] && req.headers['if-range'] !== etag) (start = 0), (end = data.length);
      else
        res.writeHead(206, {
          'content-range': `bytes ${start}-${end - 1}/${data.length}`,
          'content-length': end - start,
          etag,
          'accept-ranges': 'bytes',
          'content-disposition': 'attachment; filename="sample-48mb.bin"',
        });
    }
    if (!res.headersSent) res.writeHead(200, { 'content-length': data.length, etag, 'accept-ranges': 'bytes' });
    // Per-connection throttle, so more connections means more throughput.
    const step = 32 * 1024;
    for (let p = start; p < end && !res.destroyed; p += step) {
      const chunk = data.subarray(p, Math.min(end, p + step));
      if (!res.write(chunk)) await new Promise((r) => res.once('drain', r));
      await sleep((chunk.length / bytesPerSec) * 1000);
    }
    res.end();
  });
  return new Promise<http.Server>((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

// --------------------------------------------------------------------- main

const args = process.argv.slice(2);
const runLocal = !args.includes('--public');
const runPublic = !args.includes('--local');

if (runLocal) {
  const data = Buffer.alloc(48 * 1024 * 1024);
  let x = 0x12345678;
  for (let i = 0; i < data.length; i += 4) {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    data.writeInt32LE(x | 0, i);
  }
  const sha = crypto.createHash('sha256').update(data).digest('hex');
  const server = await localServer(data, 0.75 * 1024 * 1024);
  const port = (server.address() as any).port;
  try {
    await scenario('local', `http://127.0.0.1:${port}/files/sample.bin`, sha, { corrupt: true, minConns: 6 });
  } finally {
    server.close();
    server.closeAllConnections();
  }
}

if (runPublic) {
  const sums = await (await fetch(PUBLIC_SUMS)).text();
  const line = sums.split('\n').find((l) => l.trim().endsWith(' linux-6.6.tar.xz'));
  if (!line) throw new Error('published checksum not found');
  const sha = line.trim().split(/\s+/)[0];
  console.log(`\npublished sha256 for linux-6.6.tar.xz: ${sha}`);
  await scenario('public', PUBLIC_URL, sha, { minConns: 4 });
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);

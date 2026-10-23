import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { FileHandle } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import type { DownloadRecord, LiveStats, Segment } from './types.ts';
import { TokenBucket, sleep } from './limiter.ts';
import { HttpError, fileNameFromResponse, parseContentRange, request } from './net.ts';

/** A segment is only halved when each half would still be at least this big. */
export const MIN_SPLIT = 128 * 1024;
/** Bytes re-fetched before a resumed position and compared with what is on disk. */
export const OVERLAP = 16 * 1024;
const MAX_RETRIES = 6;
const UNKNOWN_END = Number.MAX_SAFE_INTEGER;

/** The server stopped honouring ranges (or the file changed): restart on one connection. */
class RangeLost extends Error {}

export interface DownloadHooks {
  global: TokenBucket;
  /** Called once the server's file name is known, before anything is written. */
  placeFile(rec: DownloadRecord): void;
  changed(): void;
}

export class Download {
  rec: DownloadRecord;
  /** Segment positions known to be on disk (fsynced); what gets persisted. */
  durable: Segment[];
  private hooks: DownloadHooks;
  private bucket: TokenBucket;
  private fh: FileHandle | null = null;
  private userAbort = new AbortController();
  private workAbort = new AbortController();
  private owners = new Set<Segment>();
  private needsCheck = new Set<Segment>();
  private segBytes = new Map<Segment, number>();
  private segSpeed = new Map<Segment, number>();
  private windowBytes = 0;
  private speed = 0;
  private lastError = '';
  private mismatches = 0;
  private rangeLost = false;
  private singleOnly = false;
  private firstRes: IncomingMessage | null = null;
  done: Promise<void> | null = null;

  constructor(rec: DownloadRecord, hooks: DownloadHooks) {
    this.rec = rec;
    this.hooks = hooks;
    this.bucket = new TokenBucket(rec.speedLimit);
    this.durable = rec.segments.map((s) => ({ ...s }));
  }

  get partPath() {
    return path.join(this.rec.dir, `.fetchline-${this.rec.id}.part`);
  }

  setSpeedLimit(bps: number) {
    this.rec.speedLimit = bps;
    this.bucket.setRate(bps);
  }

  start(): Promise<void> {
    this.done ??= this.run().finally(() => (this.done = null));
    return this.done;
  }

  async pause(): Promise<void> {
    this.userAbort.abort();
    this.workAbort.abort();
    await this.done;
  }

  // ---------------------------------------------------------------- lifecycle

  private async run() {
    const rec = this.rec;
    this.userAbort = new AbortController();
    rec.status = 'downloading';
    rec.error = undefined;
    this.hooks.changed();
    try {
      let attempt = 0;
      for (;;) {
        this.workAbort = new AbortController();
        this.userAbort.signal.addEventListener('abort', () => this.workAbort.abort(), { once: true });
        this.rangeLost = false;
        if (!(await this.prepare())) await this.begin();
        await this.runWorkers();
        if (this.userAbort.signal.aborted) break;
        if (this.rangeLost && attempt++ < 2) {
          this.note('Server stopped honouring byte ranges; restarting on a single connection.');
          await this.closeFile();
          this.singleOnly = true;
          rec.segments = [];
          continue;
        }
        break;
      }
      if (this.userAbort.signal.aborted) {
        rec.status = 'paused';
        return;
      }
      if (!this.isComplete()) throw new Error(this.lastError || 'Download did not complete');
      await this.closeFile();
      await this.finish();
    } catch (e) {
      if (this.userAbort.signal.aborted) rec.status = 'paused';
      else {
        rec.status = 'error';
        rec.error = (e as Error).message;
        this.note(`Failed: ${rec.error}`);
      }
    } finally {
      await this.checkpoint().catch(() => {});
      await this.closeFile();
      this.speed = 0;
      this.hooks.changed();
    }
  }

  /** Reopens an interrupted download. Returns false when it has to start over. */
  private async prepare(): Promise<boolean> {
    const rec = this.rec;
    if (!rec.resumable || !rec.segments.length || rec.size == null) return false;
    try {
      this.fh = await fs.open(this.partPath, 'r+');
    } catch {
      this.note('Partial file is missing; starting over.');
      return false;
    }
    // Only trust what was fsynced; anything past it is re-fetched.
    rec.segments = this.durable.map((s) => ({ ...s }));
    for (const s of rec.segments) if (s.pos > s.start && s.pos < s.end) this.needsCheck.add(s);
    const done = rec.segments.reduce((n, s) => n + (s.pos - s.start), 0);
    this.note(`Resuming at ${done} of ${rec.size} bytes in ${rec.segments.length} segment(s).`);
    return true;
  }

  /** Fresh start: the first request doubles as the probe, so no extra HEAD round trip. */
  private async begin() {
    const rec = this.rec;
    const { res } = await request(rec.url, {
      headers: { ...rec.headers, range: 'bytes=0-' },
      signal: this.workAbort.signal,
    });
    const cr = parseContentRange(res.headers['content-range']);
    if (res.statusCode === 206 && cr && cr.start === 0 && cr.total != null) {
      rec.size = cr.total;
      rec.resumable = true;
    } else {
      const len = Number(res.headers['content-length']);
      rec.size = Number.isFinite(len) && res.headers['content-length'] ? len : null;
      rec.resumable = false;
    }
    rec.etag = (res.headers.etag as string) || undefined;
    rec.lastModified = (res.headers['last-modified'] as string) || undefined;
    if (!rec.fileNameLocked) rec.fileName = fileNameFromResponse(res, rec.url);
    this.hooks.placeFile(rec);
    await fs.mkdir(rec.dir, { recursive: true });
    this.fh = await fs.open(this.partPath, 'w+');
    if (rec.size != null) await this.fh.truncate(rec.size);
    rec.segments = [{ start: 0, end: rec.size ?? UNKNOWN_END, pos: 0 }];
    this.durable = rec.segments.map((s) => ({ ...s }));
    this.mismatches = 0;
    this.firstRes = res;
    this.note(
      `Started: ${rec.size ?? 'unknown'} bytes, ` +
        (rec.resumable ? `resumable, up to ${rec.connections} connections.` : 'not resumable, 1 connection.'),
    );
    this.hooks.changed();
  }

  private async runWorkers() {
    const rec = this.rec;
    const want = rec.resumable && !this.singleOnly ? Math.max(1, rec.connections) : 1;
    const workers: Promise<void>[] = [];
    if (this.firstRes) {
      const seg = rec.segments[0];
      this.owners.add(seg);
      workers.push(this.worker(seg, this.firstRes));
      this.firstRes = null;
    }
    while (workers.length < want) workers.push(this.worker(null));
    await Promise.all(workers);
    this.owners.clear();
  }

  // ------------------------------------------------------------------ workers

  private async worker(seg: Segment | null, res?: IncomingMessage) {
    const signal = this.workAbort.signal;
    let failures = 0;
    while (!signal.aborted) {
      if (!seg) {
        seg = this.pickWork();
        if (!seg) return;
        failures = 0;
      }
      try {
        await this.fetchSegment(seg, res);
        res = undefined;
        if (seg.pos >= seg.end) {
          this.release(seg);
          seg = null;
          continue;
        }
        if (signal.aborted) break;
        throw new Error('Connection closed before the range was complete');
      } catch (e) {
        res?.destroy();
        res = undefined;
        if (signal.aborted) break;
        if (e instanceof RangeLost) {
          this.rangeLost = true;
          this.workAbort.abort();
          break;
        }
        const fatal = e instanceof HttpError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429;
        failures = fatal ? MAX_RETRIES + 1 : failures + 1;
        this.lastError = (e as Error).message;
        if (failures > MAX_RETRIES) {
          this.note(`Connection gave up at byte ${seg.pos}: ${this.lastError}`);
          this.release(seg);
          return;
        }
        this.note(`Connection error at byte ${seg.pos}: ${this.lastError}; retry ${failures}/${MAX_RETRIES}.`);
        await sleep(Math.min(30_000, 1000 * 2 ** (failures - 1)), signal);
      }
    }
    if (seg) this.release(seg);
  }

  private release(seg: Segment) {
    this.owners.delete(seg);
    this.segSpeed.delete(seg);
    this.segBytes.delete(seg);
  }

  /**
   * Dynamic segmentation: take an orphaned segment if there is one, otherwise
   * halve the segment with the most bytes left and work on its second half.
   */
  private pickWork(): Segment | null {
    const rec = this.rec;
    for (const s of rec.segments) {
      if (s.pos < s.end && !this.owners.has(s)) {
        this.owners.add(s);
        return s;
      }
    }
    if (!rec.resumable || rec.size == null || this.singleOnly) return null;
    let best: Segment | null = null;
    for (const s of this.owners) if (!best || s.end - s.pos > best.end - best.pos) best = s;
    if (!best) return null;
    const left = best.end - best.pos;
    if (left < 2 * MIN_SPLIT) return null;
    const mid = best.pos + Math.floor(left / 2);
    const fresh: Segment = { start: mid, end: best.end, pos: mid };
    best.end = mid;
    rec.segments.push(fresh);
    rec.segments.sort((a, b) => a.start - b.start);
    this.owners.add(fresh);
    return fresh;
  }

  private async fetchSegment(seg: Segment, res?: IncomingMessage) {
    const rec = this.rec;
    const signal = this.workAbort.signal;
    const fh = this.fh!;
    const check = this.needsCheck.has(seg) ? Math.min(OVERLAP, seg.pos - seg.start) : 0;
    this.needsCheck.delete(seg);
    if (!res) {
      const from = seg.pos - check;
      const headers: Record<string, string> = { ...rec.headers };
      if (rec.resumable) {
        headers.range = `bytes=${from}-${seg.end - 1}`;
        const validator = rec.etag ?? rec.lastModified;
        if (validator) headers['if-range'] = validator;
      }
      ({ res } = await request(rec.url, { headers, signal }));
      if (rec.resumable) {
        const cr = parseContentRange(res.headers['content-range']);
        if (res.statusCode !== 206 || !cr || cr.start !== from) {
          res.resume();
          throw new RangeLost(`Expected a range from byte ${from}, got HTTP ${res.statusCode}`);
        }
        if (cr.total != null && cr.total !== rec.size) {
          res.resume();
          throw new RangeLost('Remote file size changed');
        }
      }
    }

    let verifyLeft = check;
    let verifyAt = seg.pos - check;
    try {
      for await (let chunk of res as AsyncIterable<Buffer>) {
        if (signal.aborted) break;
        if (verifyLeft > 0) {
          const k = Math.min(verifyLeft, chunk.length);
          const disk = Buffer.alloc(k);
          await fh.read(disk, 0, k, verifyAt);
          if (!disk.equals(chunk.subarray(0, k))) {
            this.mismatches++;
            this.note(`Resume check failed near byte ${verifyAt}; re-downloading segment from ${seg.start}.`);
            seg.pos = seg.start;
            if (this.mismatches > 1) throw new RangeLost('Resume data did not match on more than one connection');
            throw new Error('Resume check mismatch');
          }
          verifyAt += k;
          verifyLeft -= k;
          chunk = chunk.subarray(k);
          if (!chunk.length) continue;
        }
        let n = Math.min(chunk.length, seg.end - seg.pos);
        if (n <= 0) break;
        await this.hooks.global.take(n, signal);
        await this.bucket.take(n, signal);
        if (signal.aborted) break;
        n = Math.min(n, seg.end - seg.pos); // a split may have moved the end meanwhile
        if (n <= 0) break;
        await fh.write(chunk, 0, n, seg.pos);
        seg.pos += n;
        this.windowBytes += n;
        this.segBytes.set(seg, (this.segBytes.get(seg) ?? 0) + n);
        if (seg.pos >= seg.end) break;
      }
      if (rec.size == null && res.complete && !signal.aborted) {
        seg.end = seg.pos;
        rec.size = seg.pos;
      }
    } finally {
      if (!res.complete) res.destroy();
    }
  }

  // ---------------------------------------------------------------- finishing

  private isComplete() {
    return this.rec.segments.length > 0 && this.rec.segments.every((s) => s.pos >= s.end);
  }

  private async finish() {
    const rec = this.rec;
    const target = await uniquePath(rec.dir, rec.fileName);
    await fs.rename(this.partPath, target);
    rec.fileName = path.basename(target);
    this.note(`Saved as ${target}`);
    await this.verify();
  }

  /** Hashes the finished file and marks the download completed (or failed on a checksum mismatch). */
  async verify() {
    this.rec.status = 'verifying';
    this.hooks.changed();
    await verifyFile(this.rec, (m) => this.note(m));
    this.hooks.changed();
  }

  private async closeFile() {
    const fh = this.fh;
    this.fh = null;
    await fh?.close().catch(() => {});
  }

  // -------------------------------------------------------- state and stats

  /** Flushes written data to disk, then records the positions as durable. */
  async checkpoint(): Promise<Segment[]> {
    const snap = this.rec.segments.map((s) => ({ ...s }));
    if (this.fh) await this.fh.datasync();
    this.durable = snap;
    return snap;
  }

  /** Called on a fixed interval to update speeds (exponential moving average). */
  tick(dtMs: number) {
    const inst = (this.windowBytes * 1000) / dtMs;
    this.speed = this.speed ? this.speed * 0.6 + inst * 0.4 : inst;
    this.windowBytes = 0;
    for (const [s, b] of this.segBytes) {
      const prev = this.segSpeed.get(s) ?? 0;
      const v = (b * 1000) / dtMs;
      this.segSpeed.set(s, prev ? prev * 0.6 + v * 0.4 : v);
      this.segBytes.set(s, 0);
    }
  }

  live(): LiveStats {
    const segs = this.rec.segments;
    return {
      speed: this.done ? this.speed : 0,
      downloaded: segs.reduce((n, s) => n + (s.pos - s.start), 0),
      connections: [...this.owners].map((s) => ({ start: s.start, end: s.end, pos: s.pos, speed: this.segSpeed.get(s) ?? 0 })),
    };
  }

  note(msg: string) {
    const line = `${new Date().toISOString()} ${msg}`;
    this.rec.log.push(line);
    if (this.rec.log.length > 200) this.rec.log.splice(0, this.rec.log.length - 200);
  }
}

/** Hashes rec's finished file (SHA-256 + MD5) and compares with the expected value if one was given. */
export async function verifyFile(rec: DownloadRecord, note: (msg: string) => void) {
  const file = path.join(rec.dir, rec.fileName);
  const sha = crypto.createHash('sha256');
  const md5 = crypto.createHash('md5');
  for await (const chunk of createReadStream(file, { highWaterMark: 1 << 20 })) {
    sha.update(chunk);
    md5.update(chunk);
  }
  rec.checksum.sha256 = sha.digest('hex');
  rec.checksum.md5 = md5.digest('hex');
  rec.checksum.match = null;
  const exp = rec.checksum.expected?.trim().toLowerCase();
  if (exp) {
    const [algo, value] = exp.includes(':') ? exp.split(':', 2) : [exp.length === 32 ? 'md5' : 'sha256', exp];
    const actual = algo === 'md5' ? rec.checksum.md5 : rec.checksum.sha256;
    rec.checksum.match = actual === value;
  }
  rec.completedAt = Date.now();
  if (rec.checksum.match === false) {
    rec.status = 'error';
    rec.error = 'Checksum mismatch';
    note(`Checksum mismatch: expected ${exp}, got sha256 ${rec.checksum.sha256}`);
  } else {
    rec.status = 'completed';
    note(`Completed. sha256 ${rec.checksum.sha256}${rec.checksum.match ? ' (matches expected)' : ''}`);
  }
}

export async function uniquePath(dir: string, name: string) {
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  for (let i = 0; ; i++) {
    const p = path.join(dir, i ? `${base} (${i})${ext}` : name);
    try {
      await fs.access(p);
    } catch {
      return p;
    }
  }
}

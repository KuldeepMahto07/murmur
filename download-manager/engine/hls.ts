import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { DownloadRecord, LiveStats, Segment } from './types.ts';
import { TokenBucket, sleep } from './limiter.ts';
import { HttpError, request, sanitizeFileName } from './net.ts';
import { uniquePath, verifyFile, type DownloadHooks } from './download.ts';

/*
 * HLS (HTTP Live Streaming) support, deliberately limited to streams anyone can
 * play without keys: any EXT-X-KEY / EXT-X-SESSION-KEY other than METHOD=NONE is
 * refused, as are live playlists. There is no DRM handling of any kind.
 */

export interface Variant {
  url: string;
  bandwidth: number;
  resolution?: string;
  codecs?: string;
  audioGroup?: string;
  label: string;
}

export interface Rendition {
  type: string;
  groupId: string;
  name: string;
  url?: string;
  isDefault: boolean;
}

export interface Playlist {
  master: boolean;
  variants: Variant[];
  renditions: Rendition[];
  segments: { url: string; duration: number }[];
  init?: string;
  encrypted: boolean;
  byteRange: boolean;
  endList: boolean;
  duration: number;
}

function attrs(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Z0-9-]+)=("([^"]*)"|[^,]*)/g;
  for (let m; (m = re.exec(line)); ) out[m[1]] = m[3] ?? m[2];
  return out;
}

export function parsePlaylist(text: string, base: string): Playlist {
  if (!text.trimStart().startsWith('#EXTM3U')) throw new Error('Not an HLS playlist');
  const pl: Playlist = { master: false, variants: [], renditions: [], segments: [], encrypted: false, byteRange: false, endList: false, duration: 0 };
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  let pendingVariant: Record<string, string> | null = null;
  let pendingDur = 0;
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      pl.master = true;
      pendingVariant = attrs(line.slice(18));
    } else if (line.startsWith('#EXT-X-MEDIA:')) {
      const a = attrs(line.slice(13));
      pl.renditions.push({ type: a.TYPE, groupId: a['GROUP-ID'], name: a.NAME ?? '', url: a.URI && new URL(a.URI, base).toString(), isDefault: a.DEFAULT === 'YES' });
    } else if (line.startsWith('#EXT-X-KEY:') || line.startsWith('#EXT-X-SESSION-KEY:')) {
      if ((attrs(line.slice(line.indexOf(':') + 1)).METHOD ?? 'NONE') !== 'NONE') pl.encrypted = true;
    } else if (line.startsWith('#EXT-X-MAP:')) {
      const a = attrs(line.slice(11));
      if (a.BYTERANGE) pl.byteRange = true;
      if (a.URI) pl.init = new URL(a.URI, base).toString();
    } else if (line.startsWith('#EXT-X-BYTERANGE')) {
      pl.byteRange = true;
    } else if (line.startsWith('#EXTINF:')) {
      pendingDur = parseFloat(line.slice(8)) || 0;
    } else if (line === '#EXT-X-ENDLIST') {
      pl.endList = true;
    } else if (!line.startsWith('#')) {
      const url = new URL(line, base).toString();
      if (pendingVariant) {
        const bw = Number(pendingVariant['AVERAGE-BANDWIDTH'] ?? pendingVariant.BANDWIDTH ?? 0);
        const res = pendingVariant.RESOLUTION;
        const height = res?.split('x')[1];
        pl.variants.push({
          url,
          bandwidth: bw,
          resolution: res,
          codecs: pendingVariant.CODECS,
          audioGroup: pendingVariant.AUDIO,
          label: `${height ? height + 'p' : 'audio/other'} · ${(bw / 1e6).toFixed(1)} Mbps`,
        });
        pendingVariant = null;
      } else {
        pl.segments.push({ url, duration: pendingDur });
        pl.duration += pendingDur;
        pendingDur = 0;
      }
    }
  }
  pl.variants.sort((a, b) => b.bandwidth - a.bandwidth);
  return pl;
}

export async function fetchPlaylist(url: string, headers?: Record<string, string>, signal?: AbortSignal) {
  const { res, finalUrl } = await request(url, { headers, signal });
  const chunks: Buffer[] = [];
  let n = 0;
  for await (const c of res as AsyncIterable<Buffer>) {
    chunks.push(c);
    if ((n += c.length) > 8 * 1024 * 1024) throw new Error('Playlist too large');
  }
  return parsePlaylist(Buffer.concat(chunks).toString('utf8'), finalUrl);
}

/** What the browser extension shows in its quality menu. */
export async function probeMedia(url: string, headers?: Record<string, string>) {
  const pl = await fetchPlaylist(url, headers);
  if (pl.master) {
    // Media playlists of variants come back flagged so the extension can hide duplicates.
    return {
      kind: 'master',
      encrypted: pl.encrypted,
      variants: pl.variants.map((v) => ({ url: v.url, label: v.label, bandwidth: v.bandwidth, resolution: v.resolution })),
      children: [...pl.variants.map((v) => v.url), ...pl.renditions.filter((r) => r.url).map((r) => r.url!)],
    };
  }
  return { kind: 'media', encrypted: pl.encrypted, live: !pl.endList, segments: pl.segments.length, duration: Math.round(pl.duration) };
}

let ffmpegPath: string | null | undefined;
async function findFfmpeg(): Promise<string | null> {
  if (ffmpegPath !== undefined) return ffmpegPath;
  ffmpegPath = await new Promise((resolve) => {
    const p = spawn(process.env.FETCHLINE_FFMPEG ?? 'ffmpeg', ['-version'], { stdio: 'ignore' });
    p.on('error', () => resolve(null));
    p.on('exit', (code) => resolve(code === 0 ? (process.env.FETCHLINE_FFMPEG ?? 'ffmpeg') : null));
  });
  return ffmpegPath;
}

interface Task {
  track: number;
  index: number;
  url: string;
  file: string;
}

const MAX_RETRIES = 6;

/**
 * Downloads every segment of an unencrypted VOD stream (in parallel, `connections`
 * at a time), keeps finished segments on disk so pause/crash only loses in-flight
 * ones, then joins them and remuxes to MP4 with ffmpeg when it is available.
 */
export class HlsDownload {
  rec: DownloadRecord;
  durable: Segment[] = [];
  done: Promise<void> | null = null;
  private hooks: DownloadHooks;
  private bucket: TokenBucket;
  private abort = new AbortController();
  private inflight = new Map<Task, { bytes: number; window: number; speed: number }>();
  private doneSet = new Set<string>();
  private windowBytes = 0;
  private speed = 0;
  private lastError = '';

  constructor(rec: DownloadRecord, hooks: DownloadHooks) {
    this.rec = rec;
    this.hooks = hooks;
    this.bucket = new TokenBucket(rec.speedLimit);
    rec.hls ??= { total: 0, done: 0, bytes: 0 };
  }

  get workDir() {
    return path.join(this.rec.dir, `.fetchline-${this.rec.id}.hls`);
  }

  setSpeedLimit(bps: number) {
    this.rec.speedLimit = bps;
    this.bucket.setRate(bps);
  }

  start() {
    this.done ??= this.run().finally(() => (this.done = null));
    return this.done;
  }

  async pause() {
    this.abort.abort();
    await this.done;
  }

  async checkpoint() {
    return this.durable;
  }

  private async run() {
    const rec = this.rec;
    const hls = rec.hls!;
    this.abort = new AbortController();
    const signal = this.abort.signal;
    rec.status = 'downloading';
    rec.error = undefined;
    this.hooks.changed();
    try {
      const tracks = await this.resolveTracks(signal);
      if (!rec.fileNameLocked || !/\.(mp4|ts|m4a|aac)$/i.test(rec.fileName)) {
        rec.fileName = sanitizeFileName(rec.fileName.replace(/\.m3u8?$/i, '') || 'video') + '.mp4';
      }
      this.hooks.placeFile(rec);
      await fs.mkdir(this.workDir, { recursive: true });

      const tasks: Task[] = [];
      tracks.forEach((pl, t) => {
        if (pl.init) tasks.push({ track: t, index: -1, url: pl.init, file: `t${t}-init.seg` });
        pl.segments.forEach((s, i) => tasks.push({ track: t, index: i, url: s.url, file: `t${t}-${String(i).padStart(6, '0')}.seg` }));
      });
      const existing = new Set(await fs.readdir(this.workDir));
      this.doneSet = new Set(tasks.filter((t) => existing.has(t.file)).map((t) => t.file));
      hls.total = tasks.length;
      hls.done = this.doneSet.size;
      if (hls.done) this.note(`Resuming: ${hls.done} of ${hls.total} segments already on disk.`);
      else this.note(`Started: ${tasks.length} segments in ${tracks.length} track(s), ${rec.connections} at a time.`);
      this.hooks.changed();

      const queue = tasks.filter((t) => !this.doneSet.has(t.file));
      const workers = Array.from({ length: Math.min(Math.max(1, rec.connections), 16) }, () => this.worker(queue, signal));
      await Promise.all(workers);
      if (signal.aborted) {
        rec.status = 'paused';
        return;
      }
      if (this.doneSet.size < tasks.length) throw new Error(this.lastError || 'Some segments failed');

      await this.assemble(tracks, tasks);
      rec.status = 'verifying';
      this.hooks.changed();
      await verifyFile(rec, (m) => this.note(m));
      await fs.rm(this.workDir, { recursive: true, force: true });
    } catch (e) {
      if (signal.aborted) rec.status = 'paused';
      else {
        rec.status = 'error';
        rec.error = (e as Error).message;
        this.note(`Failed: ${rec.error}`);
      }
    } finally {
      this.inflight.clear();
      this.speed = 0;
      this.hooks.changed();
    }
  }

  /** Master → chosen (or best) variant plus its separate audio rendition, if any. */
  private async resolveTracks(signal: AbortSignal) {
    const rec = this.rec;
    const hls = rec.hls!;
    let pl = await fetchPlaylist(rec.url, rec.headers, signal);
    const tracks = [];
    if (pl.master) {
      if (pl.encrypted) throw new Error('Encrypted stream (DRM/keys) — not supported');
      const v = pl.variants.find((x) => x.url === hls.variant) ?? pl.variants[0];
      if (!v) throw new Error('Master playlist has no variants');
      hls.variant = v.url;
      hls.label = v.label;
      const audio = v.audioGroup
        ? pl.renditions.filter((r) => r.type === 'AUDIO' && r.groupId === v.audioGroup && r.url).sort((a, b) => +b.isDefault - +a.isDefault)[0]
        : undefined;
      tracks.push(await fetchPlaylist(v.url, rec.headers, signal));
      if (audio) tracks.push(await fetchPlaylist(audio.url!, rec.headers, signal));
    } else {
      tracks.push(pl);
    }
    for (const t of tracks) {
      if (t.encrypted) throw new Error('Encrypted stream (DRM/keys) — not supported');
      if (!t.endList) throw new Error('Live stream — only finished (VOD) streams are supported');
      if (t.byteRange) throw new Error('Byte-range HLS is not supported yet');
      if (!t.segments.length) throw new Error('Playlist has no segments');
    }
    return tracks;
  }

  private async worker(queue: Task[], signal: AbortSignal) {
    while (!signal.aborted) {
      const task = queue.shift();
      if (!task) return;
      for (let attempt = 1; ; attempt++) {
        try {
          await this.fetchTask(task, signal);
          break;
        } catch (e) {
          if (signal.aborted) return;
          this.lastError = (e as Error).message;
          const fatal = e instanceof HttpError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429;
          if (fatal || attempt > MAX_RETRIES) {
            this.note(`Segment ${task.file} failed: ${this.lastError}`);
            return;
          }
          await sleep(Math.min(30_000, 1000 * 2 ** (attempt - 1)), signal);
        }
      }
    }
  }

  private async fetchTask(task: Task, signal: AbortSignal) {
    const stat = { bytes: 0, window: 0, speed: 0 };
    this.inflight.set(task, stat);
    try {
      const { res } = await request(task.url, { headers: this.rec.headers, signal });
      const chunks: Buffer[] = [];
      for await (const c of res as AsyncIterable<Buffer>) {
        await this.hooks.global.take(c.length, signal);
        await this.bucket.take(c.length, signal);
        if (signal.aborted) {
          res.destroy();
          return;
        }
        chunks.push(c);
        stat.bytes += c.length;
        stat.window += c.length;
        this.windowBytes += c.length;
      }
      if (!res.complete) throw new Error('Segment transfer cut short');
      // Write, fsync, then rename: a segment file that exists is always complete.
      const tmp = path.join(this.workDir, task.file + '.tmp');
      const fh = await fs.open(tmp, 'w');
      await fh.writeFile(Buffer.concat(chunks));
      await fh.datasync();
      await fh.close();
      await fs.rename(tmp, path.join(this.workDir, task.file));
      this.doneSet.add(task.file);
      this.rec.hls!.done = this.doneSet.size;
      this.rec.hls!.bytes += stat.bytes;
    } finally {
      this.inflight.delete(task);
    }
  }

  private async assemble(tracks: Playlist[], tasks: Task[]) {
    const rec = this.rec;
    const joined: string[] = [];
    for (let t = 0; t < tracks.length; t++) {
      const fmp4 = !!tracks[t].init;
      const out = path.join(this.workDir, `track${t}.${fmp4 ? 'mp4' : 'ts'}`);
      const fh = await fs.open(out, 'w');
      for (const task of tasks.filter((x) => x.track === t)) await fh.writeFile(await fs.readFile(path.join(this.workDir, task.file)));
      await fh.close();
      joined.push(out);
    }
    const ffmpeg = await findFfmpeg();
    let produced: string;
    if (ffmpeg) {
      produced = path.join(this.workDir, 'output.mp4');
      const args = ['-hide_banner', '-loglevel', 'error', '-y'];
      for (const j of joined) args.push('-i', j);
      if (joined.length > 1) args.push('-map', '0:v:0', '-map', '1:a:0');
      args.push('-c', 'copy', '-movflags', '+faststart', produced);
      await run(ffmpeg, args);
      this.note(`Joined ${tasks.length} segments and remuxed to MP4 with ffmpeg.`);
    } else {
      if (joined.length > 1) throw new Error('This stream has separate audio; install ffmpeg to merge it');
      produced = joined[0];
      if (produced.endsWith('.ts')) rec.fileName = rec.fileName.replace(/\.mp4$/i, '.ts');
      this.note('ffmpeg not found; saved the joined stream without remuxing.');
    }
    await fs.mkdir(rec.dir, { recursive: true });
    const target = await uniquePath(rec.dir, rec.fileName);
    await fs.rename(produced, target);
    rec.fileName = path.basename(target);
    rec.size = (await fs.stat(target)).size;
    this.note(`Saved as ${target}`);
  }

  async verify() {
    this.rec.status = 'verifying';
    await verifyFile(this.rec, (m) => this.note(m));
    this.hooks.changed();
  }

  tick(dtMs: number) {
    const inst = (this.windowBytes * 1000) / dtMs;
    this.speed = this.speed ? this.speed * 0.6 + inst * 0.4 : inst;
    this.windowBytes = 0;
    for (const s of this.inflight.values()) {
      const v = (s.window * 1000) / dtMs;
      s.speed = s.speed ? s.speed * 0.6 + v * 0.4 : v;
      s.window = 0;
    }
  }

  live(): LiveStats {
    const hls = this.rec.hls!;
    return {
      speed: this.done ? this.speed : 0,
      downloaded: hls.bytes + [...this.inflight.values()].reduce((n, s) => n + s.bytes, 0),
      // Segment indices stand in for byte offsets in the UI's connection table.
      connections: [...this.inflight.keys()].map((t) => ({ start: t.index, end: t.index + 1, pos: t.index, speed: this.inflight.get(t)!.speed })),
    };
  }

  note(msg: string) {
    this.rec.log.push(`${new Date().toISOString()} ${msg}`);
    if (this.rec.log.length > 200) this.rec.log.splice(0, this.rec.log.length - 200);
  }
}

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    let err = '';
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${err.trim().slice(-300)}`))));
  });
}

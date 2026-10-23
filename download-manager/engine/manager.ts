import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import type { Category, DownloadRecord, Settings } from './types.ts';
import { Download } from './download.ts';
import { HlsDownload } from './hls.ts';
import { YtdlpDownload, type BrowserCookie } from './ytdlp.ts';
import { TokenBucket } from './limiter.ts';
import { fileNameFromUrl, sanitizeFileName } from './net.ts';

const TICK_MS = 500;
const SAVE_MS = 1000;

export interface AddRequest {
  url: string;
  fileName?: string;
  dir?: string;
  category?: string;
  connections?: number;
  speedLimit?: number;
  checksum?: string;
  description?: string;
  headers?: Record<string, string>;
  /** 'hls' for an .m3u8 stream (detected from the URL when omitted); 'ytdlp' hands the page URL to yt-dlp. */
  kind?: 'file' | 'hls' | 'ytdlp';
  /** For kind 'ytdlp': the chosen yt-dlp format selector and its menu label. */
  ytdlp?: { format: string; label?: string; audioOnly?: boolean; approxSize?: number | null; cookies?: BrowserCookie[] };
  /** For a master playlist: which variant (media playlist URL) to fetch. */
  variant?: string;
  pageUrl?: string;
  /** 'now' starts immediately, 'queue' waits for the queue, 'paused' just lists it. */
  start?: 'now' | 'queue' | 'paused';
}

export function defaultSettings(baseDir: string): Settings {
  const cat = (name: string, exts: string) => ({ name, exts: exts.split(' '), dir: path.join(baseDir, name) });
  return {
    baseDir,
    connections: 8,
    maxConcurrent: 3,
    globalSpeedLimit: 0,
    categories: [
      cat('Archives', 'zip rar 7z tar gz xz bz2 zst iso'),
      cat('Documents', 'pdf doc docx xls xlsx ppt pptx txt epub csv'),
      cat('Music', 'mp3 flac wav aac ogg m4a opus'),
      cat('Programs', 'exe msi dmg pkg deb rpm appimage apk'),
      cat('Video', 'mp4 mkv webm avi mov m4v ts m3u8'),
      cat('Images', 'jpg jpeg png gif webp svg bmp tiff'),
    ],
    scheduler: { enabled: false, startAt: '02:00', stopAt: '', onDone: 'none' },
  };
}

export class Manager {
  readonly dataDir: string;
  settings!: Settings;
  records = new Map<string, DownloadRecord>();
  active = new Map<string, Download | HlsDownload | YtdlpDownload>();
  queueRunning = false;
  /** True when the scheduler (not the user) started the queue; only then do completion actions run. */
  private queueAuto = false;
  private global = new TokenBucket(0);
  private dirty = true;
  private saving = false;
  private lastSchedule = '';
  private listeners = new Set<() => void>();
  private timers: NodeJS.Timeout[] = [];
  onExit: () => void = () => {};

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  private get stateFile() {
    return path.join(this.dataDir, 'state.json');
  }

  async load() {
    await fs.mkdir(this.dataDir, { recursive: true });
    let saved: { settings?: Settings; downloads?: DownloadRecord[]; queueRunning?: boolean } = {};
    try {
      saved = JSON.parse(await fs.readFile(this.stateFile, 'utf8'));
    } catch {}
    this.settings = { ...defaultSettings(path.join(this.dataDir, 'Downloads')), ...saved.settings };
    this.global.setRate(this.settings.globalSpeedLimit);
    for (const r of saved.downloads ?? []) {
      for (const s of r.segments) if (s.end === null) s.end = Number.MAX_SAFE_INTEGER; // JSON has no Infinity
      this.records.set(r.id, r);
    }
    this.queueRunning = !!saved.queueRunning;

    // Crash recovery: anything that was running when the process died picks up again.
    for (const r of this.records.values()) {
      if (r.status === 'downloading') {
        this.note(r, 'Recovered after an unexpected shutdown.');
        this.handle(r).start();
      } else if (r.status === 'verifying') {
        this.handle(r).verify().catch((e) => this.fail(r, e));
      }
    }
    this.timers.push(setInterval(() => this.tick(), TICK_MS));
    this.timers.push(setInterval(() => this.save(), SAVE_MS));
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed = () => {
    this.dirty = true;
  };

  private handle(rec: DownloadRecord): Download | HlsDownload | YtdlpDownload {
    let d = this.active.get(rec.id);
    if (!d) {
      const hooks = { global: this.global, changed: this.changed, placeFile: (r: DownloadRecord) => this.placeFile(r) };
      d = rec.kind === 'hls' ? new HlsDownload(rec, hooks) : rec.kind === 'ytdlp' ? new YtdlpDownload(rec, hooks) : new Download(rec, hooks);
      this.active.set(rec.id, d);
    }
    return d;
  }

  // ------------------------------------------------------------- categories

  categoryFor(fileName: string): Category | undefined {
    const ext = path.extname(fileName).slice(1).toLowerCase();
    return this.settings.categories.find((c) => c.exts.includes(ext));
  }

  /** Once the real file name is known, file it under the matching category (unless the user chose a folder). */
  private placeFile(rec: DownloadRecord) {
    if (rec.category !== 'General') return;
    const cat = this.categoryFor(rec.fileName);
    if (cat) {
      rec.category = cat.name;
      rec.dir = cat.dir;
    }
  }

  // ---------------------------------------------------------------- actions

  add(req: AddRequest): DownloadRecord {
    const url = new URL(req.url.trim()); // throws on garbage
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http and https URLs are supported');
    const kind = req.kind ?? (/\.m3u8?$/i.test(url.pathname) ? 'hls' : 'file');
    if (kind === 'ytdlp' && !req.ytdlp?.format) throw new Error('ytdlp.format is required');
    let fileName = req.fileName ? sanitizeFileName(req.fileName) : fileNameFromUrl(url.toString());
    // yt-dlp picks the real name; this placeholder (with the right extension) just files it under Video/Music.
    if (kind === 'ytdlp') fileName = fileName.replace(/\.[a-z0-9]{2,4}$/i, '') + (req.ytdlp!.audioOnly ? '.m4a' : '.mp4');
    const headers = req.headers
      ? Object.fromEntries(Object.entries(req.headers).filter(([k, v]) => typeof v === 'string' && ALLOWED_HEADERS.has(k.toLowerCase())).map(([k, v]) => [k.toLowerCase(), v]))
      : undefined;
    const cat =
      (req.category && this.settings.categories.find((c) => c.name === req.category)) ||
      (req.dir ? undefined : this.categoryFor(fileName));
    const rec: DownloadRecord = {
      id: crypto.randomBytes(6).toString('hex'),
      kind,
      hls: kind === 'hls' ? { variant: req.variant, total: 0, done: 0, bytes: 0 } : undefined,
      ytdlp:
        kind === 'ytdlp'
          ? {
              format: String(req.ytdlp!.format),
              label: String(req.ytdlp!.label ?? req.ytdlp!.format),
              audioOnly: !!req.ytdlp!.audioOnly,
              approxSize: req.ytdlp!.approxSize ?? null,
              cookies: Array.isArray(req.ytdlp!.cookies) ? req.ytdlp!.cookies : undefined,
              downloaded: 0,
              total: 0,
            }
          : undefined,
      pageUrl: req.pageUrl,
      url: url.toString(),
      fileName,
      fileNameLocked: !!req.fileName && kind !== 'ytdlp',
      dir: req.dir || cat?.dir || path.join(this.settings.baseDir, 'General'),
      category: cat?.name ?? (req.dir ? 'Custom' : 'General'),
      size: null,
      resumable: false,
      status: req.start === 'now' ? 'downloading' : req.start === 'paused' ? 'paused' : 'queued',
      segments: [],
      connections: clamp(req.connections ?? this.settings.connections, 1, 32),
      speedLimit: Math.max(0, req.speedLimit ?? 0),
      inQueue: req.start === 'queue' || req.start === undefined,
      addedAt: Date.now(),
      headers,
      checksum: { expected: req.checksum || undefined },
      description: req.description,
      log: [],
    };
    this.records.set(rec.id, rec);
    this.note(rec, `Added ${rec.url}`);
    if (rec.status === 'downloading') this.handle(rec).start();
    this.dirty = true;
    return rec;
  }

  get(id: string) {
    const r = this.records.get(id);
    if (!r) throw new Error('No such download');
    return r;
  }

  /** Manual start: like the reference app, it bypasses the queue's concurrency limit. */
  resume(id: string) {
    const r = this.get(id);
    if (r.status === 'completed' || r.status === 'verifying') return;
    this.handle(r).start();
  }

  async pause(id: string) {
    const r = this.get(id);
    const d = this.active.get(id);
    if (d?.done) await d.pause();
    else if (r.status === 'queued') r.status = 'paused';
    this.dirty = true;
  }

  async pauseAll() {
    await Promise.all([...this.records.keys()].map((id) => this.pause(id)));
  }

  async remove(id: string, deleteFile: boolean) {
    const r = this.get(id);
    const d = this.active.get(id);
    if (d?.done) await d.pause();
    this.active.delete(id);
    this.records.delete(id);
    await fs.rm(path.join(r.dir, `.fetchline-${r.id}.part`), { force: true });
    await fs.rm(path.join(r.dir, `.fetchline-${r.id}.hls`), { recursive: true, force: true });
    if (deleteFile && r.status === 'completed') await fs.rm(path.join(r.dir, r.fileName), { force: true });
    this.dirty = true;
  }

  async redownload(id: string) {
    const r = this.get(id);
    await this.pause(id);
    r.segments = [];
    r.size = null;
    r.checksum = { expected: r.checksum.expected };
    if (r.hls) {
      r.hls = { variant: r.hls.variant, total: 0, done: 0, bytes: 0 };
      await fs.rm(path.join(r.dir, `.fetchline-${r.id}.hls`), { recursive: true, force: true });
    }
    const d = this.active.get(id);
    if (d) d.durable = [];
    this.handle(r).start();
  }

  update(id: string, patch: Partial<Pick<DownloadRecord, 'url' | 'speedLimit' | 'connections' | 'description' | 'inQueue'>> & { checksum?: string }) {
    const r = this.get(id);
    if (patch.url) {
      new URL(patch.url);
      r.url = patch.url; // e.g. refresh an expired link; validators still guard against a different file
    }
    if (patch.connections) r.connections = clamp(patch.connections, 1, 32);
    if (patch.description !== undefined) r.description = patch.description;
    if (patch.inQueue !== undefined) r.inQueue = patch.inQueue;
    if (patch.checksum !== undefined) r.checksum.expected = patch.checksum || undefined;
    if (patch.speedLimit !== undefined) {
      r.speedLimit = Math.max(0, patch.speedLimit);
      this.active.get(id)?.setSpeedLimit(r.speedLimit);
    }
    this.dirty = true;
  }

  updateSettings(patch: Partial<Settings>) {
    Object.assign(this.settings, patch);
    this.settings.connections = clamp(this.settings.connections, 1, 32);
    this.settings.maxConcurrent = clamp(this.settings.maxConcurrent, 1, 20);
    this.global.setRate(this.settings.globalSpeedLimit);
    this.dirty = true;
  }

  startQueue(auto = false) {
    this.queueRunning = true;
    this.queueAuto = auto;
    for (const r of this.records.values()) if (r.inQueue && (r.status === 'paused' || r.status === 'error')) r.status = 'queued';
    this.dirty = true;
  }

  async stopQueue() {
    this.queueRunning = false;
    this.queueAuto = false;
    await Promise.all(
      [...this.records.values()].filter((r) => r.inQueue && r.status === 'downloading').map((r) => this.pause(r.id)),
    );
    for (const r of this.records.values()) if (r.inQueue && r.status === 'paused') r.status = 'queued';
    this.dirty = true;
  }

  // ------------------------------------------------------------ background

  private tick() {
    for (const d of this.active.values()) if (d.done) d.tick(TICK_MS);
    this.runQueue();
    this.runScheduler();
    this.dirty = true; // speeds change every tick
    for (const fn of this.listeners) fn();
  }

  private runQueue() {
    if (!this.queueRunning) return;
    const queued = [...this.records.values()].filter((r) => r.inQueue);
    let running = queued.filter((r) => r.status === 'downloading' || r.status === 'verifying').length;
    for (const r of queued) {
      if (running >= this.settings.maxConcurrent) break;
      if (r.status === 'queued') {
        this.handle(r).start();
        running++;
      }
    }
    if (running === 0 && !queued.some((r) => r.status === 'queued')) {
      this.queueRunning = false;
      if (this.queueAuto) this.whenQueueDone();
    }
  }

  private whenQueueDone() {
    const action = this.settings.scheduler.onDone;
    this.queueAuto = false;
    if (action === 'exit') setTimeout(() => this.onExit(), 1000);
    if (action === 'shutdown' && process.platform === 'win32') {
      // 60 s grace so the user can cancel with `shutdown /a`.
      spawn('shutdown', ['/s', '/t', '60', '/c', 'Fetchline: queue finished'], { detached: true, stdio: 'ignore' }).unref();
    }
  }

  private runScheduler() {
    const s = this.settings.scheduler;
    if (!s.enabled) return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const key = `${now.toDateString()} ${hhmm}`;
    if (key === this.lastSchedule) return;
    if (hhmm === s.startAt) {
      this.lastSchedule = key;
      this.startQueue(true);
    } else if (s.stopAt && hhmm === s.stopAt) {
      this.lastSchedule = key;
      this.stopQueue();
    }
  }

  /** Writes state atomically: positions come from each download's last fsynced checkpoint. */
  async save() {
    if (!this.dirty || this.saving) return;
    this.saving = true;
    this.dirty = false;
    try {
      const downloads: DownloadRecord[] = [];
      for (const r of this.records.values()) {
        const d = this.active.get(r.id);
        const segments = d?.done ? await d.checkpoint().catch(() => d.durable) : d ? d.durable : r.segments;
        downloads.push({ ...r, segments: segments.map((s) => ({ ...s })) });
      }
      const json = JSON.stringify(
        { version: 1, settings: this.settings, queueRunning: this.queueRunning, downloads },
        (_k, v) => (v === Number.MAX_SAFE_INTEGER ? null : v),
      );
      const tmp = this.stateFile + '.tmp';
      const fh = await fs.open(tmp, 'w');
      await fh.writeFile(json);
      await fh.sync();
      await fh.close();
      await fs.rename(tmp, this.stateFile);
    } catch (e) {
      this.dirty = true;
      console.error('save failed', e);
    } finally {
      this.saving = false;
    }
  }

  async shutdown() {
    for (const t of this.timers) clearInterval(t);
    const running = [...this.active.values()].filter((d) => d.done);
    await Promise.all(running.map((d) => d.pause()));
    // Paused by exit, not by the user: resume them next launch.
    for (const d of running) if (d.rec.status === 'paused') d.rec.status = 'downloading';
    this.dirty = true;
    while (this.saving) await new Promise((r) => setTimeout(r, 20));
    await this.save();
  }

  // --------------------------------------------------------------- snapshot

  snapshot() {
    return {
      queueRunning: this.queueRunning,
      settings: this.settings,
      downloads: [...this.records.values()].map((r) => {
        const live = this.active.get(r.id)?.live();
        return {
          ...r,
          segments: r.segments.map((s) => ({ ...s, end: s.end === Number.MAX_SAFE_INTEGER ? null : s.end })),
          log: undefined,
          headers: undefined,
          ytdlp: r.ytdlp ? { ...r.ytdlp, cookies: undefined } : undefined,
          downloaded:
            live?.downloaded ??
            (r.kind === 'hls' ? r.hls?.bytes ?? 0 : r.kind === 'ytdlp' ? r.ytdlp?.downloaded ?? 0 : r.segments.reduce((n, s) => n + (s.pos - s.start), 0)),
          progress:
            r.status === 'completed'
              ? 1
              : r.kind === 'ytdlp'
                ? r.ytdlp?.total ? Math.min(0.99, r.ytdlp.downloaded / r.ytdlp.total) : 0
                : r.kind === 'hls' ? (r.hls?.total ? r.hls.done / r.hls.total : 0) : r.size ? r.segments.reduce((n, s) => n + (s.pos - s.start), 0) / r.size : 0,
          speed: live?.speed ?? 0,
          activeConnections: live?.connections ?? [],
        };
      }),
    };
  }

  private note(r: DownloadRecord, msg: string) {
    r.log.push(`${new Date().toISOString()} ${msg}`);
  }

  private fail(r: DownloadRecord, e: unknown) {
    r.status = 'error';
    r.error = (e as Error).message;
    this.dirty = true;
  }
}

/** Request headers a browser hand-off may pass on (needed by CDNs that check them). */
const ALLOWED_HEADERS = new Set(['cookie', 'referer', 'user-agent', 'origin', 'authorization', 'accept-language']);

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Math.round(Number(n) || lo)));
}

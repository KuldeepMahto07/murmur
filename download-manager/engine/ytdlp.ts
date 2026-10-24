import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import type { DownloadRecord, LiveStats, Segment } from './types.ts';
import { verifyFile, type DownloadHooks } from './download.ts';

/*
 * yt-dlp integration (https://github.com/yt-dlp/yt-dlp), added at the project
 * owner's request for sites such as YouTube and Instagram. yt-dlp is an external
 * program the user installs (winget install yt-dlp.yt-dlp); Harbor only runs it.
 * It does not handle DRM-protected media, and neither does Harbor.
 */

export interface BrowserCookie {
  domain: string;
  hostOnly?: boolean;
  path?: string;
  secure?: boolean;
  expirationDate?: number;
  name: string;
  value: string;
}

export interface YtdlpChoice {
  id: string;
  label: string;
  format: string;
  audioOnly: boolean;
  approxSize: number | null;
}

let found: { bin: string; version: string } | null | undefined;

/** Locates yt-dlp: FETCHLINE_YTDLP, then winget's link (newest), then PATH. */
export async function ytdlpInfo(): Promise<{ bin: string; version: string } | null> {
  if (found !== undefined) return found;
  const candidates = [
    process.env.FETCHLINE_YTDLP,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', 'yt-dlp.exe'),
    'yt-dlp',
  ].filter((c): c is string => !!c && (c === 'yt-dlp' || existsSync(c)));
  for (const bin of candidates) {
    const out = await run(bin, ['--version'], 15_000).catch(() => null);
    if (out?.code === 0) return (found = { bin, version: out.stdout.trim() });
  }
  return (found = null);
}

/** Netscape cookies.txt from the extension's chrome.cookies objects. */
export function cookieFile(cookies: BrowserCookie[]) {
  const lines = ['# Netscape HTTP Cookie File'];
  for (const c of cookies) {
    if (!c?.name || typeof c.value !== 'string' || !c.domain) continue;
    const domain = c.hostOnly || c.domain.startsWith('.') ? c.domain : '.' + c.domain;
    lines.push([domain, domain.startsWith('.') ? 'TRUE' : 'FALSE', c.path || '/', c.secure ? 'TRUE' : 'FALSE', Math.floor(c.expirationDate ?? 0), c.name, c.value].join('\t'));
  }
  return lines.join('\n') + '\n';
}

async function withCookies<T>(dir: string, cookies: BrowserCookie[] | undefined, fn: (args: string[]) => Promise<T>) {
  if (!cookies?.length) return fn([]);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `.cookies-${process.pid}-${Date.now()}.txt`);
  await fs.writeFile(file, cookieFile(cookies), { mode: 0o600 });
  try {
    return await fn(['--cookies', file]);
  } finally {
    await fs.rm(file, { force: true });
  }
}

/** Asks yt-dlp what it can get from a page and turns it into a short quality menu. */
export async function probeYtdlp(url: string, cookies: BrowserCookie[] | undefined, tmpDir: string) {
  const info = await ytdlpInfo();
  if (!info) throw new Error("Video-site support isn't set up on this PC yet.");
  if (!/^https?:\/\//i.test(url)) throw new Error('Only http(s) pages can be checked');
  const out = await withCookies(tmpDir, cookies, (cookieArgs) =>
    run(info.bin, ['-J', '--no-playlist', '--no-warnings', '--no-progress', ...cookieArgs, url], 90_000),
  );
  if (out.code !== 0) throw new Error(lastError(out.stderr) || 'Could not read this page');
  const j = JSON.parse(out.stdout);
  if (j._type === 'playlist') throw new Error('This page is a playlist; open a single video');
  const formats: any[] = j.formats ?? [];
  const size = (f: any) => f?.filesize ?? f?.filesize_approx ?? null;
  const audios = formats.filter((f) => f.vcodec === 'none' && f.acodec && f.acodec !== 'none');
  const bestAudio = audios.sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0))[0];
  const heights = [...new Set(formats.filter((f) => f.vcodec && f.vcodec !== 'none' && f.height).map((f) => f.height as number))].sort((a, b) => b - a);
  const choices: YtdlpChoice[] = [];
  for (const h of heights.filter((h) => h >= 240).slice(0, 6)) {
    const vids = formats.filter((f) => f.height === h && f.vcodec !== 'none');
    const v = vids.sort((a, b) => (size(b) ?? 0) - (size(a) ?? 0))[0];
    const merged = v?.acodec && v.acodec !== 'none';
    const approx = size(v) != null ? size(v) + (merged ? 0 : size(bestAudio) ?? 0) : null;
    choices.push({ id: `h${h}`, label: `${h}p MP4`, format: `bv*[height<=${h}][vcodec^=avc1]+ba[ext=m4a]/bv*[height<=${h}]+ba/b[height<=${h}]/b`, audioOnly: false, approxSize: approx });
  }
  if (!choices.length) choices.push({ id: 'best', label: 'Best quality', format: 'bv*+ba/b', audioOnly: false, approxSize: size(formats.at(-1)) });
  if (bestAudio) choices.push({ id: 'audio', label: 'Audio only (M4A)', format: 'ba[ext=m4a]/ba/b', audioOnly: true, approxSize: size(bestAudio) });
  return {
    title: j.title as string,
    extractor: (j.extractor_key ?? j.extractor) as string,
    duration: j.duration ?? null,
    webpageUrl: (j.webpage_url ?? url) as string,
    drm: formats.length > 0 && formats.every((f) => f.has_drm),
    choices,
  };
}

/** One yt-dlp run per download; pausing stops the process, resuming reruns it with --continue. */
export class YtdlpDownload {
  rec: DownloadRecord;
  durable: Segment[] = [];
  done: Promise<void> | null = null;
  private hooks: DownloadHooks;
  private child: ChildProcess | null = null;
  private paused = false;
  private speed = 0;
  private current = { format: '', bytes: 0 };
  private finished = 0;

  constructor(rec: DownloadRecord, hooks: DownloadHooks) {
    this.rec = rec;
    this.hooks = hooks;
  }

  setSpeedLimit(bps: number) {
    this.rec.speedLimit = bps; // applied on the next (re)start of yt-dlp
  }

  start() {
    this.done ??= this.run().finally(() => (this.done = null));
    return this.done;
  }

  async pause() {
    this.paused = true;
    if (this.child) killTree(this.child);
    await this.done;
  }

  async checkpoint() {
    return this.durable;
  }

  private async run() {
    const rec = this.rec;
    const y = rec.ytdlp!;
    this.paused = false;
    rec.status = 'downloading';
    rec.error = undefined;
    this.hooks.placeFile(rec);
    this.hooks.changed();
    try {
      const info = await ytdlpInfo();
      if (!info) throw new Error("Video-site support isn't set up on this PC yet.");
      await fs.mkdir(rec.dir, { recursive: true });
      const args = [
        '--encoding', 'utf-8',
      '--no-playlist', '--newline', '--no-colors', '--progress', '--continue', '--windows-filenames', '--no-mtime',
        '-f', y.format,
        '-P', rec.dir,
        '-o', '%(title).150B [%(id)s].%(ext)s',
        '-N', String(Math.min(8, Math.max(1, rec.connections))),
        '--progress-template', 'download:FLP %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s %(progress.speed)s %(info.format_id)s',
        '--print', 'after_move:FLFILE %(filepath)s',
      ];
      if (!y.audioOnly) args.push('--merge-output-format', 'mp4');
      if (rec.speedLimit) args.push('-r', String(rec.speedLimit));
      this.note(`Video-site download: ${y.label} from ${rec.url}`);
      let finalPath = '';
      let lastErr = '';
      const code = await withCookies(rec.dir, y.cookies, (cookieArgs) =>
        new Promise<number>((resolve, reject) => {
          const child = spawn(info.bin, [...args, ...cookieArgs, rec.url], { windowsHide: true, env: UTF8_ENV });
          this.child = child;
          let buf = '';
          const onLine = (line: string) => {
            if (line.startsWith('FLP ')) this.progress(line);
            else if (line.startsWith('FLFILE ')) finalPath = line.slice(7).trim();
            else if (line.startsWith('ERROR:')) lastErr = line.slice(6).trim();
            else if (line.startsWith('[Merger]')) {
              y.phase = 'merging';
              this.hooks.changed();
            }
          };
          const feed = (d: string) => {
            buf += d;
            let i;
            while ((i = buf.indexOf('\n')) >= 0) {
              onLine(buf.slice(0, i).replace(/\r$/, ''));
              buf = buf.slice(i + 1);
            }
          };
          // setEncoding keeps multi-byte characters intact across chunk boundaries.
          child.stdout!.setEncoding('utf8').on('data', feed);
          child.stderr!.setEncoding('utf8').on('data', feed);
          child.on('error', reject);
          child.on('close', (c) => resolve(c ?? -1));
        }),
      );
      this.child = null;
      if (this.paused) {
        rec.status = 'paused';
        return;
      }
      if (code !== 0 || !finalPath) throw new Error(friendly(lastErr) || `The download stopped unexpectedly (code ${code})`);
      finalPath = await locate(finalPath);
      rec.dir = path.dirname(finalPath);
      rec.fileName = path.basename(finalPath);
      rec.size = (await fs.stat(finalPath)).size;
      y.downloaded = rec.size;
      y.phase = 'done';
      this.note(`Saved as ${finalPath}`);
      rec.status = 'verifying';
      this.hooks.changed();
      await verifyFile(rec, (m) => this.note(m));
    } catch (e) {
      if (this.paused) rec.status = 'paused';
      else {
        rec.status = 'error';
        rec.error = (e as Error).message;
        this.note(`Failed: ${rec.error}`);
      }
    } finally {
      this.child = null;
      this.speed = 0;
      this.hooks.changed();
    }
  }

  /** "FLP <downloaded> <total> <estimate> <speed> <format_id>"; merged downloads fetch video then audio. */
  private progress(line: string) {
    const [, dl, total, est, speed, fmt] = line.split(' ');
    const y = this.rec.ytdlp!;
    const n = (s: string) => (s && s !== 'NA' && s !== 'None' ? Number(s) : 0);
    if (fmt !== this.current.format) {
      this.finished += this.current.bytes;
      this.current = { format: fmt, bytes: 0 };
    }
    this.current.bytes = n(dl);
    this.speed = n(speed);
    y.downloaded = this.finished + this.current.bytes;
    const streamTotal = n(total) || n(est);
    y.total = Math.max(y.total ?? 0, this.finished + streamTotal, y.approxSize ?? 0);
    y.phase = 'downloading';
  }

  async verify() {
    this.rec.status = 'verifying';
    await verifyFile(this.rec, (m) => this.note(m));
    this.hooks.changed();
  }

  tick(_dtMs: number) {}

  live(): LiveStats {
    return { speed: this.done ? this.speed : 0, downloaded: this.rec.ytdlp?.downloaded ?? 0, connections: [] };
  }

  note(msg: string) {
    this.rec.log.push(`${new Date().toISOString()} ${msg}`);
    if (this.rec.log.length > 200) this.rec.log.splice(0, this.rec.log.length - 200);
  }
}

/**
 * The Windows yt-dlp.exe is a launcher that starts a second process, and it may run
 * ffmpeg too, so stopping only the direct child leaves the download running.
 */
function killTree(child: ChildProcess) {
  if (process.platform === 'win32' && child.pid) {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  } else child.kill('SIGTERM');
}

// yt-dlp is a Python program; on Windows its stdout otherwise uses the console code page,
// which drops characters such as emoji from titles and so from the reported file path.
const UTF8_ENV = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };

/** The reported path, or (if decoding still mangled it) the file in that folder with the same "[video id]" tag. */
export async function locate(reported: string) {
  try {
    await fs.access(reported);
    return reported;
  } catch {}
  const dir = path.dirname(reported);
  const tag = /\[[^\]]+\]\.[a-z0-9]+$/i.exec(path.basename(reported))?.[0];
  if (tag) {
    const hits = (await fs.readdir(dir)).filter((f) => f.endsWith(tag) && !f.endsWith('.part'));
    if (hits.length) {
      const stats = await Promise.all(hits.map(async (f) => ({ f, t: (await fs.stat(path.join(dir, f))).mtimeMs })));
      return path.join(dir, stats.sort((a, b) => b.t - a.t)[0].f);
    }
  }
  return reported;
}

function lastError(stderr: string) {
  const lines = stderr.split(/\r?\n/).filter((l) => l.startsWith('ERROR:'));
  return friendly(lines.at(-1)?.slice(6).trim());
}

/**
 * Error text shown in the app and extension: drop the helper's own name, its
 * command-line hints and links, and the "[extractor] id:" prefix.
 */
export function friendly(msg: string | undefined) {
  if (!msg) return msg;
  return msg
    .replace(/^\[[^\]]+\]\s*[^:]{1,40}:\s*/, '')
    .replace(/\s*(See|Also see)\s+https?:\/\/\S+.*$/i, '')
    .replace(/\s*Use --[\w-]+.*$/i, '')
    .replace(/https?:\/\/github\.com\/yt-dlp\S*/gi, '')
    .replace(/yt-dlp/gi, 'the downloader')
    .trim();
}

function run(bin: string, args: string[], timeoutMs: number) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true, env: UTF8_ENV });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    const t = setTimeout(() => killTree(child), timeoutMs);
    child.on('error', (e) => (clearTimeout(t), reject(e)));
    child.on('close', (code) => (clearTimeout(t), resolve({ code: code ?? -1, stdout, stderr })));
  });
}

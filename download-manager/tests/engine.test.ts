// Unit tests for the engine's pure logic. Run: node --test tests/
// (End-to-end behaviour is covered by scripts/verify*.ts.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseContentRange, fileNameFromResponse, fileNameFromUrl, sanitizeFileName } from '../engine/net.ts';
import { parsePlaylist } from '../engine/hls.ts';
import { TokenBucket } from '../engine/limiter.ts';
import { Download, MIN_SPLIT } from '../engine/download.ts';
import { cookieFile, locate } from '../engine/ytdlp.ts';
import { Manager, withoutSecrets } from '../engine/manager.ts';
import { redactError, errorSummary } from '../engine/server.ts';
import type { DownloadRecord } from '../engine/types.ts';

// ------------------------------------------------------------------ net.ts

test('parseContentRange: end-exclusive range and total', () => {
  assert.deepEqual(parseContentRange('bytes 100-199/1000'), { start: 100, end: 200, total: 1000 });
  assert.deepEqual(parseContentRange('bytes 0-0/*'), { start: 0, end: 1, total: null });
  assert.equal(parseContentRange(undefined), null);
  assert.equal(parseContentRange('items 1-2/3'), null);
});

test('fileNameFromResponse: RFC 5987 filename* wins over filename and URL', () => {
  const res = (cd: string) => ({ headers: { 'content-disposition': cd } }) as any;
  assert.equal(fileNameFromResponse(res(`attachment; filename="plain.zip"; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf`), 'https://x.test/a'), 'résumé.pdf');
  assert.equal(fileNameFromResponse(res('attachment; filename="report 2026.xlsx"'), 'https://x.test/a'), 'report 2026.xlsx');
  assert.equal(fileNameFromResponse({ headers: {} } as any, 'https://x.test/dir/file%20name.iso?x=1'), 'file name.iso');
});

test('sanitizeFileName: strips path and reserved characters and Windows device names', () => {
  assert.equal(sanitizeFileName('..\\..\\evil:name?.txt'), '_.._evil_name_.txt');
  assert.equal(sanitizeFileName('a/b<c>d|e"f*g'), 'a_b_c_d_e_f_g');
  assert.equal(sanitizeFileName('CON'), 'download');
  assert.equal(sanitizeFileName('lpt1.txt'), 'download');
  assert.equal(sanitizeFileName('   '), 'download');
  assert.equal(fileNameFromUrl('https://x.test/'), 'download');
});

// ------------------------------------------------------------------ hls.ts

test('parsePlaylist: master with audio group, sorted variants, relative URIs', () => {
  const pl = parsePlaylist(
    [
      '#EXTM3U',
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="English",DEFAULT=YES,URI="audio/en.m3u8"',
      '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,AUDIO="aud"',
      'v360/index.m3u8',
      '#EXT-X-STREAM-INF:BANDWIDTH=2400000,RESOLUTION=1280x720',
      'https://cdn.test/v720/index.m3u8',
    ].join('\n'),
    'https://x.test/hls/master.m3u8',
  );
  assert.equal(pl.master, true);
  assert.deepEqual(pl.variants.map((v) => v.label), ['720p · 2.4 Mbps', '360p · 0.8 Mbps']);
  assert.equal(pl.variants[1].url, 'https://x.test/hls/v360/index.m3u8');
  assert.equal(pl.variants[1].audioGroup, 'aud');
  assert.equal(pl.renditions[0].url, 'https://x.test/hls/audio/en.m3u8');
});

test('parsePlaylist: media playlist flags encryption, live, byte ranges', () => {
  const vod = parsePlaylist('#EXTM3U\n#EXTINF:2.0,\na.ts\n#EXTINF:1.5,\nb.ts\n#EXT-X-ENDLIST\n', 'https://x.test/p.m3u8');
  assert.equal(vod.segments.length, 2);
  assert.equal(vod.duration, 3.5);
  assert.equal(vod.endList, true);
  assert.equal(vod.encrypted, false);
  assert.equal(parsePlaylist('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="k"\n#EXTINF:2,\na.ts\n', 'https://x.test/').encrypted, true);
  assert.equal(parsePlaylist('#EXTM3U\n#EXT-X-KEY:METHOD=NONE\n#EXTINF:2,\na.ts\n', 'https://x.test/').encrypted, false);
  assert.equal(parsePlaylist('#EXTM3U\n#EXTINF:2,\na.ts\n', 'https://x.test/').endList, false);
  assert.equal(parsePlaylist('#EXTM3U\n#EXT-X-BYTERANGE:100@0\n#EXTINF:2,\na.ts\n', 'https://x.test/').byteRange, true);
  assert.throws(() => parsePlaylist('<html>', 'https://x.test/'), /Not an HLS playlist/);
});

// ------------------------------------------------------------------ limiter.ts

test('TokenBucket: 8 concurrent takers share the rate', async () => {
  const rate = 400_000;
  const bucket = new TokenBucket(rate);
  const t0 = performance.now();
  // 8 × 100 KB = 800 KB; the first 400 KB is the bucket's burst, so about 1 s of waiting.
  await Promise.all(Array.from({ length: 8 }, () => bucket.take(100_000)));
  const s = (performance.now() - t0) / 1000;
  assert.ok(s > 0.8 && s < 1.5, `took ${s.toFixed(2)} s`);
  const free = new TokenBucket(0);
  const t1 = performance.now();
  await free.take(10_000_000);
  assert.ok(performance.now() - t1 < 20, 'rate 0 means unlimited');
});

// ------------------------------------------------------------------ download.ts (dynamic segmentation)

function rec(size: number): DownloadRecord {
  return {
    id: 't', url: 'https://x.test/f', fileName: 'f', fileNameLocked: false, dir: os.tmpdir(), category: 'General', size,
    resumable: true, status: 'paused', segments: [{ start: 0, end: size, pos: 0 }], connections: 8, speedLimit: 0, inQueue: false,
    addedAt: 0, checksum: {}, log: [],
  };
}
const hooks = { global: new TokenBucket(0), placeFile() {}, changed() {} };

test('pickWork: takes an orphaned segment before splitting', () => {
  const d = new Download(rec(10 * MIN_SPLIT), hooks) as any;
  const first = d.pickWork();
  assert.deepEqual(first, { start: 0, end: 10 * MIN_SPLIT, pos: 0 }, 'orphan returned as-is');
  const second = d.pickWork();
  assert.equal(second.start, 5 * MIN_SPLIT, 'largest owned segment halved');
  assert.equal(first.end, 5 * MIN_SPLIT, 'owner of the split segment now stops at the midpoint');
  assert.equal(d.rec.segments.length, 2);
});

test('pickWork: never splits below the minimum and never on non-resumable files', () => {
  const small = new Download(rec(2 * MIN_SPLIT - 1), hooks) as any;
  small.pickWork();
  assert.equal(small.pickWork(), null, 'segment too small to halve');
  const r = rec(100 * MIN_SPLIT);
  r.resumable = false;
  const single = new Download(r, hooks) as any;
  single.pickWork();
  assert.equal(single.pickWork(), null, 'no splitting without range support');
});

test('pickWork: splits relative to progress, not the original start', () => {
  const r = rec(10 * MIN_SPLIT);
  r.segments[0].pos = 6 * MIN_SPLIT; // 4 × MIN_SPLIT left
  const d = new Download(r, hooks) as any;
  d.pickWork();
  const s = d.pickWork();
  assert.equal(s.start, 8 * MIN_SPLIT);
});

// ------------------------------------------------------------------ ytdlp.ts helpers

test('cookieFile: Netscape format with domain flags and skips junk', () => {
  const txt = cookieFile([
    { domain: '.youtube.com', path: '/', secure: true, expirationDate: 1893456000.5, name: 'SID', value: 'abc' },
    { domain: 'www.instagram.com', hostOnly: true, path: '/', secure: true, name: 'sessionid', value: 'x' },
    { domain: '', name: 'bad', value: 'y' } as any,
  ]);
  const lines = txt.trim().split('\n');
  assert.equal(lines[0], '# Netscape HTTP Cookie File');
  assert.equal(lines[1], '.youtube.com\tTRUE\t/\tTRUE\t1893456000\tSID\tabc');
  assert.equal(lines[2], 'www.instagram.com\tFALSE\t/\tTRUE\t0\tsessionid\tx');
  assert.equal(lines.length, 3);
});

test('locate: finds a file by its [id] tag when the reported name lost characters', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fl-locate-'));
  const real = path.join(dir, 'Strong？! 🤯 [npVoSRs7oR0].mp4');
  await fs.writeFile(real, 'x');
  await fs.writeFile(path.join(dir, 'other [npVoSRs7oR0].f298.mp4.part'), 'x');
  assert.equal(await locate(path.join(dir, 'Strong!  [npVoSRs7oR0].mp4')), real);
  assert.equal(await locate(real), real);
  await fs.rm(dir, { recursive: true });
});

// ------------------------------------------------------------------ manager.ts

test('Manager.add: validation, categories, kinds', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fl-mgr-'));
  const m = new Manager(dir);
  await m.load();
  try {
    assert.throws(() => m.add({ url: 'file:///etc/passwd', start: 'paused' }), /Only http/);
    assert.throws(() => m.add({ url: 'not a url', start: 'paused' }));
    const iso = m.add({ url: 'https://x.test/ubuntu.iso', start: 'paused' });
    assert.equal(iso.category, 'Archives');
    const hls = m.add({ url: 'https://x.test/master.m3u8', start: 'paused' });
    assert.equal(hls.kind, 'hls');
    const yt = m.add({ url: 'https://www.youtube.com/watch?v=x', kind: 'ytdlp', fileName: 'Talk', start: 'paused', ytdlp: { format: 'b', audioOnly: true } });
    assert.equal(yt.fileName, 'Talk.m4a');
    assert.equal(yt.category, 'Music');
    assert.throws(() => m.add({ url: 'https://x.test/', kind: 'ytdlp', start: 'paused' } as any), /format is required/);
    const h = m.add({ url: 'https://x.test/a.zip', start: 'paused', headers: { Cookie: 'a=1', 'X-Evil': '1', Referer: 'https://x.test/' } });
    assert.deepEqual(h.headers, { cookie: 'a=1', referer: 'https://x.test/' }, 'only allow-listed headers, lower-cased');
    const snap = m.snapshot().downloads.find((d: any) => d.id === yt.id);
    assert.equal(snap.headers, undefined, 'snapshot hides headers');
  } finally {
    await m.shutdown();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('withoutSecrets: drops cookie/authorization and yt-dlp cookies, keeps the rest', () => {
  const r = {
    headers: { cookie: 'sid=1', authorization: 'Bearer x', referer: 'https://a.example/', 'user-agent': 'UA' },
    ytdlp: { format: 'best', cookies: [{ domain: '.a.example', name: 'sid', value: '1' }] },
  } as unknown as DownloadRecord;
  const out = withoutSecrets(r);
  assert.deepEqual(out.headers, { referer: 'https://a.example/', 'user-agent': 'UA' });
  assert.equal(out.ytdlp?.cookies, undefined);
  assert.equal(out.ytdlp?.format, 'best');
  assert.deepEqual(withoutSecrets({} as DownloadRecord), { headers: undefined, ytdlp: undefined });
});

test('redactError: no URLs, hosts or paths reach a bug report', () => {
  assert.equal(redactError('HTTP 403 from https://cdn.example.com/a/b.mp4?sig=abc'), 'HTTP 403 from <url>');
  assert.equal(redactError(String.raw`EPERM: operation not permitted, open 'C:\Users\me\Downloads\Harbor\x.zip'`),"EPERM: operation not permitted, open '<path>'");
  assert.equal(redactError('getaddrinfo ENOTFOUND files.example.org'), 'getaddrinfo ENOTFOUND <host>');
  assert.equal(redactError('ENOENT /home/me/file.bin'), 'ENOENT <path>');
  assert.equal(redactError('Checksum mismatch'), 'Checksum mismatch');
});

test('errorSummary: groups redacted messages, most common first', () => {
  assert.equal(errorSummary([undefined]), 'none');
  assert.equal(
    errorSummary(['HTTP 403 from https://a.example/1', 'HTTP 403 from https://b.example/2', 'ECONNRESET', undefined]),
    'HTTP 403 from <url> ×2 · ECONNRESET ×1',
  );
});

/**
 * Release build. Writes to dist/ (gitignored):
 *   fetchline-extension-direct-<v>.zip  extension as-is (yt-dlp on) for GitHub Releases / sideloading
 *   fetchline-extension-store-<v>.zip   yt-dlp code stripped, for the Chrome Web Store and Edge Add-ons
 *   fetchline-<v>-windows.zip           app: engine, UI, tray launcher, direct extension, docs
 *   SHA256SUMS.txt
 *
 *   node scripts/build.ts                 build everything
 *   node scripts/build.ts --check-store   only build + verify the store variant (used by CI)
 *
 * Store stripping uses markers in the extension source:
 *   "@ytdlp:start" … "@ytdlp:end"   (any comment syntax)  remove the block
 *   "… // @ytdlp-line"                                       remove the line
 *   "… // @store-replace: <code>"                            replace the line with <code>
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const checkOnly = process.argv.includes('--check-store');

// ------------------------------------------------------------------ zip writer (store method: deflate)

type Entry = { name: string; data: Buffer };

function zip(entries: Entry[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const dosTime = 0x0000; // 00:00:00
  const dosDate = (2026 - 1980) << 9 | (1 << 5) | 1; // fixed date → reproducible archives
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const name = Buffer.from(e.name.replace(/\\/g, '/'), 'utf8');
    const deflated = zlib.deflateRawSync(e.data, { level: 9 });
    const crc = zlib.crc32(e.data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, deflated);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(dosTime, 12);
    cen.writeUInt16LE(dosDate, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(deflated.length, 20);
    cen.writeUInt32LE(e.data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, name);
    offset += 30 + name.length + deflated.length;
  }
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cenBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cenBuf, end]);
}

async function collect(dir: string, prefix = '', skip: (rel: string) => boolean = () => false): Promise<Entry[]> {
  const out: Entry[] = [];
  for (const d of await fs.readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${d.name}` : d.name;
    if (skip(rel)) continue;
    const full = path.join(dir, d.name);
    if (d.isDirectory()) out.push(...(await collect(full, rel, skip)));
    else out.push({ name: rel, data: await fs.readFile(full) });
  }
  return out;
}

// ------------------------------------------------------------------ store stripping

export function stripForStore(text: string): string {
  const out: string[] = [];
  let skipping = false;
  for (const line of text.split('\n')) {
    if (line.includes('@ytdlp:start')) {
      skipping = true;
      continue;
    }
    if (line.includes('@ytdlp:end')) {
      skipping = false;
      continue;
    }
    if (skipping || line.includes('@ytdlp-line')) continue;
    const m = /^(\s*).*\/\/ @store-replace: (.*)$/.exec(line);
    out.push(m ? m[1] + m[2] : line);
  }
  if (skipping) throw new Error('unterminated @ytdlp:start');
  return out.join('\n');
}

async function extensionEntries(variant: 'direct' | 'store'): Promise<Entry[]> {
  const entries = await collect(path.join(ROOT, 'extension'));
  if (variant === 'direct') return entries;
  return entries.map((e) =>
    /\.(js|html|json)$/.test(e.name) ? { ...e, data: Buffer.from(stripForStore(e.data.toString('utf8')), 'utf8') } : e,
  );
}

/** The store build must not contain any yt-dlp code or wording, and its scripts must still parse. */
async function checkStore(entries: Entry[]) {
  const problems: string[] = [];
  const tmp = await fs.mkdtemp(path.join(ROOT, 'dist', '.check-'));
  try {
    for (const e of entries) {
      if (!/\.(js|html|json)$/.test(e.name)) continue;
      const text = e.data.toString('utf8');
      for (const bad of [/yt-?dlp/i, /youtube/i, /instagram/i, /@ytdlp|@store-replace/]) if (bad.test(text)) problems.push(`${e.name}: contains ${bad}`);
      if (e.name.endsWith('.js')) {
        const f = path.join(tmp, e.name.replace(/\//g, '_'));
        await fs.writeFile(f, text);
        try {
          execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
        } catch (err: any) {
          problems.push(`${e.name}: does not parse: ${String(err.stderr).trim().split('\n')[0]}`);
        }
      }
    }
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
  return problems;
}

// ------------------------------------------------------------------ main

const manifest = JSON.parse(await fs.readFile(path.join(ROOT, 'extension', 'manifest.json'), 'utf8'));
const pkg = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));
const v = manifest.version;
if (pkg.version !== v) {
  console.error(`version mismatch: extension/manifest.json ${v} vs package.json ${pkg.version}`);
  process.exit(1);
}
await fs.mkdir(DIST, { recursive: true });

const store = await extensionEntries('store');
const problems = await checkStore(store);
if (problems.length) {
  console.error('Store build check FAILED:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`store build check passed (${store.length} files, no yt-dlp code, scripts parse)`);
if (checkOnly) process.exit(0);

const outputs: [string, Buffer][] = [
  [`fetchline-extension-store-${v}.zip`, zip(store)],
  [`fetchline-extension-direct-${v}.zip`, zip(await extensionEntries('direct'))],
];
const appSkip = (rel: string) => /^(data|dist|tests|node_modules|\.git|saas)(\/|$)/.test(rel) || rel === 'scripts' || rel.endsWith('.part');
const app = (await collect(ROOT, '', appSkip)).map((e) => ({ ...e, name: `Fetchline-${v}/${e.name}` }));
outputs.push([`fetchline-${v}-windows.zip`, zip(app)]);

const sums: string[] = [];
for (const [name, buf] of outputs) {
  await fs.writeFile(path.join(DIST, name), buf);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  sums.push(`${sha}  ${name}`);
  console.log(`${name.padEnd(42)} ${(buf.length / 1024).toFixed(0).padStart(6)} KB  ${sha.slice(0, 16)}…`);
}
await fs.writeFile(path.join(DIST, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
console.log(`wrote ${path.relative(process.cwd(), DIST) || 'dist'}/SHA256SUMS.txt`);

/**
 * Builds the Windows installer: dist/Harbor-Setup-<version>.exe
 *
 *   node scripts/build-installer.ts          (npm run installer)
 *
 * Stages the app files, bundles this machine's Node.js runtime (with its licence),
 * then compiles installer/harbor.iss with Inno Setup 6 (winget install JRSoftware.InnoSetup).
 * Code signing is not done here yet; unsigned installers trigger SmartScreen.
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const STAGE = path.join(DIST, 'installer-stage');

const version = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8')).version;
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 24) throw new Error(`Node ${process.versions.node} is too old to bundle; need 24+`);

const iscc = [
  process.env.ISCC,
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Inno Setup 6', 'ISCC.exe'),
  'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
].find((p): p is string => !!p && existsSync(p));
if (!iscc) throw new Error('Inno Setup 6 not found (winget install JRSoftware.InnoSetup)');

// ---- stage: the same app files as the Windows zip, plus Node, icon and helpers
await fs.rm(STAGE, { recursive: true, force: true });
await fs.mkdir(STAGE, { recursive: true });
const skip = /^(data|dist|tests|node_modules|\.git|saas|scripts|installer|site)(\\|\/|$)/;
for (const entry of await fs.readdir(ROOT)) {
  if (skip.test(entry) || entry === 'start.bat' || entry === '.gitignore') continue;
  await fs.cp(path.join(ROOT, entry), path.join(STAGE, entry), {
    recursive: true,
    filter: (src) => !/\.(part|log)$/.test(src) && !src.includes(`${path.sep}.fetchline-`),
  });
}
await fs.mkdir(path.join(STAGE, 'node'), { recursive: true });
await fs.copyFile(process.execPath, path.join(STAGE, 'node', 'node.exe'));
await fs.copyFile(path.join(ROOT, 'installer', 'third-party', 'NODE-LICENSE.txt'), path.join(STAGE, 'node', 'LICENSE.txt'));
await fs.writeFile(path.join(STAGE, 'node', 'VERSION.txt'), `Node.js ${process.version} (bundled runtime)\n`);
await fs.copyFile(path.join(ROOT, 'installer', 'harbor.ico'), path.join(STAGE, 'harbor.ico'));
await fs.copyFile(path.join(ROOT, 'installer', 'stop-harbor.ps1'), path.join(STAGE, 'desktop', 'stop-harbor.ps1'));

// ---- compile.  --test builds an isolated variant (own AppId/name/shortcuts) used only by
// scripts/verify-installer.ps1, so testing install/uninstall never touches a real install.
const test = process.argv.includes('--test');
const defs = [`/DAppVersion=${version}`, `/DStageDir=${STAGE}`, `/DOutDir=${DIST}`];
if (test) defs.push('/DTestBuild');
execFileSync(iscc, ['/Q', ...defs, path.join(ROOT, 'installer', 'harbor.iss')], { stdio: 'inherit' });

const exe = path.join(DIST, test ? 'Harbor-Setup-test.exe' : `Harbor-Setup-${version}.exe`);
const buf = await fs.readFile(exe);
const sha = crypto.createHash('sha256').update(buf).digest('hex');
if (!test) {
  // The test installer is a throwaway; only the real installer goes in the checksums file.
  const sums = path.join(DIST, 'SHA256SUMS.txt');
  const old = existsSync(sums) ? (await fs.readFile(sums, 'utf8')).split('\n').filter((l) => l && !l.endsWith(path.basename(exe))) : [];
  await fs.writeFile(sums, [...old, `${sha}  ${path.basename(exe)}`].join('\n') + '\n');
}
console.log(`${path.basename(exe)}  ${(buf.length / 1048576).toFixed(1)} MB  sha256 ${sha.slice(0, 16)}…  (Node ${process.version} bundled)${test ? '  [test build]' : ''}`);

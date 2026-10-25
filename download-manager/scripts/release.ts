/**
 * Cuts a Harbor release: bumps the version everywhere, builds the artifacts, and
 * writes release notes — then prints the git tag/push commands for you to run.
 * It never commits, tags or pushes on its own (publishing is a deliberate step).
 *
 *   node scripts/release.ts              bump the patch version (0.4.1 -> 0.4.2)
 *   node scripts/release.ts minor        0.4.1 -> 0.5.0
 *   node scripts/release.ts major        0.4.1 -> 1.0.0
 *   node scripts/release.ts 0.6.0        set an exact version
 *   node scripts/release.ts --dry        show what would change, build nothing
 *   node scripts/release.ts --no-build   bump + notes only (skip installer/zips)
 *
 * The matching CI job (.github/workflows/fetchline.yml) builds the same artifacts and
 * attaches them to a GitHub Release when you push a tag like v0.5.0. Signing and store
 * uploads stay out of this script: they need the owner's certificate and store accounts.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const noBuild = args.includes('--no-build');
const bumpArg = args.find((a) => !a.startsWith('--')) ?? 'patch';

const pkgPath = path.join(ROOT, 'package.json');
const manifestPath = path.join(ROOT, 'extension', 'manifest.json');
const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
const current: string = pkg.version;
const next = nextVersion(current, bumpArg);

console.log(`Harbor release: ${current} -> ${next}${dry ? '  (dry run)' : ''}`);

if (!dry) {
  await setVersion(pkgPath, next);
  await setVersion(manifestPath, next);
  console.log(`  updated package.json and extension/manifest.json`);
}

const notes = await releaseNotes(current, next);
if (!dry) {
  await fs.mkdir(path.join(ROOT, 'dist'), { recursive: true });
  const notesFile = path.join(ROOT, 'dist', `RELEASE_NOTES-${next}.md`);
  await fs.writeFile(notesFile, notes);
  console.log(`  wrote ${path.relative(ROOT, notesFile)}`);
}

if (!dry && !noBuild) {
  console.log('\nBuilding artifacts…');
  run('node', ['--disable-warning=ExperimentalWarning', 'scripts/build.ts']); // zips + SHA256SUMS
  try {
    run('node', ['--disable-warning=ExperimentalWarning', 'scripts/build-installer.ts']); // Windows installer
  } catch {
    console.log('  (installer skipped — Inno Setup not installed on this machine; CI builds it)');
  }
}

console.log(`\nNotes preview:\n${notes.split('\n').map((l) => '  ' + l).join('\n')}`);
console.log(`\nNext, to publish:`);
console.log(`  git add download-manager/package.json download-manager/extension/manifest.json`);
console.log(`  git commit -m "Harbor ${next}"`);
console.log(`  git tag v${next}`);
console.log(`  git push && git push origin v${next}`);
console.log(`\nPushing the tag triggers the release job, which builds and attaches the installer and zips.`);

// --------------------------------------------------------------------------- helpers

function nextVersion(cur: string, how: string): string {
  if (/^\d+\.\d+\.\d+/.test(how)) return how; // explicit version
  const [maj, min, pat] = cur.split('.').map(Number);
  if (how === 'major') return `${maj + 1}.0.0`;
  if (how === 'minor') return `${maj}.${min + 1}.0`;
  if (how === 'patch') return `${maj}.${min}.${pat + 1}`;
  throw new Error(`Unknown bump "${how}" (use patch, minor, major, or an exact x.y.z)`);
}

/** Replaces the "version" value while leaving the rest of the JSON formatting intact. */
async function setVersion(file: string, version: string) {
  const text = await fs.readFile(file, 'utf8');
  const out = text.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`);
  if (out === text) throw new Error(`Could not find a version field in ${file}`);
  await fs.writeFile(file, out);
}

async function releaseNotes(from: string, to: string): Promise<string> {
  let commits = '';
  // Harbor-only commits since the previous tag (or the last 30 if there's no tag yet).
  const lastTag = tryGit(['describe', '--tags', '--abbrev=0', '--match', 'v*']);
  const range = lastTag ? [`${lastTag}..HEAD`] : ['-n', '30'];
  const log = tryGit(['log', ...range, '--pretty=format:%s', '--', 'download-manager']);
  commits = (log ?? '')
    .split('\n')
    .filter(Boolean)
    .map((s) => `- ${s.replace(/^Harbor:?\s*/i, '')}`)
    .join('\n');
  return [
    `# Harbor ${to}`,
    '',
    commits || `- (fill in the changes since ${from})`,
    '',
    '## Install',
    '- **Windows:** download `Harbor-Setup-' + to + '.exe` below and run it.',
    '- **Browser button:** load `harbor-extension-direct-' + to + '.zip` unpacked, or install from the store.',
    '',
    'Verify your download against `SHA256SUMS.txt`.',
    '',
  ].join('\n');
}

function tryGit(a: string[]): string | null {
  try {
    return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function run(cmd: string, a: string[]) {
  execFileSync(cmd, a, { cwd: ROOT, stdio: 'inherit' });
}

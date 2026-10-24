import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Manager } from './manager.ts';
import { createServer } from './server.ts';

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: process.env.FETCHLINE_PORT ?? '8765' },
    data: { type: 'string', default: process.env.FETCHLINE_DATA },
  },
});

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.resolve(values.data ?? path.join(root, 'data'));
const port = Number(values.port);

// Sort out the port before touching state, so an older instance can save first.
await claimPort();

const mgr = new Manager(dataDir);
await mgr.load();
const server = createServer(mgr, port);

let exiting = false;
async function exit() {
  if (exiting) return;
  exiting = true;
  server.close();
  await mgr.shutdown();
  process.exit(0);
}
mgr.onExit = exit;
process.on('SIGINT', exit);
process.on('SIGTERM', exit);

server.listen(port, '127.0.0.1', () => {
  console.log(`Harbor engine on http://127.0.0.1:${port}  (data: ${dataDir}, pid ${process.pid})`);
});

async function claimPort() {
  if (await portFree()) return;
  const base = `http://127.0.0.1:${port}/api`;
  const ping = await fetch(`${base}/ping`).catch(() => null);
  if (ping?.ok) {
    console.log(`Harbor is already running on http://127.0.0.1:${port}`);
    process.exit(0);
  }
  // An older Harbor (from before /ping existed) still answers /state: ask it to save and exit.
  const old = await fetch(`${base}/state`).catch(() => null);
  if (old?.ok) {
    console.log('Closing an older Harbor that is still running…');
    await fetch(`${base}/shutdown`, { method: 'POST', headers: { 'x-fetchline': '1' } }).catch(() => {});
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 200));
      if (await portFree()) return;
    }
  }
  console.error(`Port ${port} is used by another program. Close it, or start with --port <number>.`);
  process.exit(1);
}

function portFree() {
  return new Promise<boolean>((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)));
  });
}

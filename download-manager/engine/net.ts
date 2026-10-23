import http from 'node:http';
import https from 'node:https';
import type { IncomingMessage } from 'node:http';

// Keep-alive agents let a connection that finished its range be reused for the
// next piece without a new TCP/TLS handshake.
const agents: Record<string, http.Agent> = {
  'http:': new http.Agent({ keepAlive: true, maxSockets: 64 }),
  'https:': new https.Agent({ keepAlive: true, maxSockets: 64 }),
};

export const USER_AGENT = 'Fetchline/0.1 (+segmented downloader)';

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxRedirects?: number;
}

export interface Response {
  res: IncomingMessage;
  finalUrl: string;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** GET/HEAD with manual redirect handling and an idle-socket timeout. */
export async function request(url: string, opts: RequestOptions = {}): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= (opts.maxRedirects ?? 10); hop++) {
    const res = await once(current, opts);
    const status = res.statusCode ?? 0;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      current = new URL(res.headers.location, current).toString();
      continue;
    }
    if (status >= 400) {
      res.resume();
      throw new HttpError(status, `HTTP ${status} ${res.statusMessage ?? ''}`.trim());
    }
    return { res, finalUrl: current };
  }
  throw new Error('Too many redirects');
}

function once(url: string, opts: RequestOptions): Promise<IncomingMessage> {
  const u = new URL(url);
  const lib = u.protocol === 'https:' ? https : u.protocol === 'http:' ? http : null;
  if (!lib) return Promise.reject(new Error(`Unsupported protocol ${u.protocol}`));
  const headers: Record<string, string> = {
    'user-agent': USER_AGENT,
    'accept-encoding': 'identity', // byte ranges must address the raw file
    ...opts.headers,
  };
  if ((u.username || u.password) && !headers.authorization) {
    const cred = `${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`;
    headers.authorization = 'Basic ' + Buffer.from(cred).toString('base64');
  }
  u.username = '';
  u.password = '';
  return new Promise((resolve, reject) => {
    const req = lib.request(
      u,
      { method: opts.method ?? 'GET', headers, agent: agents[u.protocol], signal: opts.signal },
      resolve,
    );
    req.setTimeout(opts.timeoutMs ?? 30_000, () => req.destroy(new Error('Connection timed out')));
    req.on('error', reject);
    req.end();
  });
}

/** Parses "bytes 100-199/1000" → { start: 100, end: 200, total: 1000 } (end exclusive). */
export function parseContentRange(v: string | undefined) {
  const m = v && /bytes\s+(\d+)-(\d+)\/(\d+|\*)/i.exec(v);
  if (!m) return null;
  return { start: +m[1], end: +m[2] + 1, total: m[3] === '*' ? null : +m[3] };
}

export function fileNameFromResponse(res: IncomingMessage, url: string): string {
  const cd = res.headers['content-disposition'];
  if (cd) {
    const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(cd);
    if (star) return sanitizeFileName(decodeURIComponent(star[1].trim()));
    const plain = /filename\s*=\s*("?)([^";]+)\1/.exec(cd);
    if (plain) return sanitizeFileName(plain[2].trim());
  }
  return fileNameFromUrl(url);
}

export function fileNameFromUrl(url: string): string {
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop();
    if (last) return sanitizeFileName(decodeURIComponent(last));
  } catch {}
  return 'download';
}

export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 200);
  if (!cleaned || /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(cleaned)) return 'download';
  return cleaned;
}

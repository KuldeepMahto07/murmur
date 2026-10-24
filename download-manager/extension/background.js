// Harbor Integration — background service worker.
//
// 1. Watches network responses for media (direct audio/video files and HLS
//    playlists) per tab, so the overlay can offer them.
// 2. Hands chosen items to the chosen download manager over its loopback API:
//    the Harbor engine, or AB Download Manager (github.com/amir1376/ab-download-manager).
// 3. Context menu "Download with Harbor", and optional takeover of normal
//    browser downloads.
//
// Scope is deliberate: no DRM handling, no site-specific extractors. Chunks of
// adaptive streams (range= URLs, .ts/.m4s segments, blob: sources) are ignored.

const DEFAULTS = { target: 'fetchline', port: 8765, abdmPort: 15151, abdmKey: '', takeover: false, ytdlp: true }; // @store-replace: const DEFAULTS = { target: 'fetchline', port: 8765, abdmPort: 15151, abdmKey: '', takeover: false };
const TARGET_NAMES = { fetchline: 'Harbor', abdm: 'AB Download Manager' };
const cfg = async () => ({ ...DEFAULTS, ...(await chrome.storage.local.get(Object.keys(DEFAULTS))) });

async function engine(method, path, body, timeoutMs = 5000) {
  const { port } = await cfg();
  const res = await fetch(`http://127.0.0.1:${port}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-fetchline': '1', 'x-fetchline-client': `extension/${chrome.runtime.getManifest().version}` },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/** AB Download Manager's integration API (the same calls its own extension makes). */
async function abdm(path, body, timeoutMs = 5000) {
  const { abdmPort, abdmKey } = await cfg();
  const headers = { 'content-type': 'application/json' };
  if (abdmKey) headers['X-Api-Key'] = abdmKey;
  const res = await fetch(`http://localhost:${abdmPort}/${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? null),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 401) throw new Error('AB Download Manager rejected the API key (set it in the extension popup)');
  if (!res.ok) throw new Error(`AB Download Manager: HTTP ${res.status}`);
  return res.text();
}

/** Is the selected download manager reachable? */
async function targetUp() {
  const { target } = await cfg();
  try {
    if (target === 'abdm') return (await abdm('ping', null, 1500)).trim() === 'pong';
    return (await engine('GET', '/ping', undefined, 1500)).app === 'fetchline';
  } catch (e) {
    console.warn(`${TARGET_NAMES[target]} not reachable:`, e);
    return false;
  }
}

// ------------------------------------------------------------ media sniffing

const MEDIA_EXT = /\.(mp4|m4v|webm|mkv|mov|avi|flv|mp3|m4a|aac|ogg|oga|opus|flac|wav)$/i;
const HLS_EXT = /\.m3u8?$/i;
const SEGMENT_EXT = /\.(ts|m4s|m4f|cmfv|cmfa|vtt|webvtt|key|mpd)$/i;
const MIN_FILE = 64 * 1024;

function headerMap(list = []) {
  return Object.fromEntries(list.map((h) => [h.name.toLowerCase(), h.value ?? '']));
}

function classify(d) {
  if (!/^https?:/i.test(d.url) || d.statusCode >= 400) return null;
  const u = new URL(d.url);
  // Byte-range chunks of a bigger adaptive stream are not downloadable files on their own.
  if (/(^|&)(range|bytestart|byterange)=/i.test(u.search.slice(1))) return null;
  const h = headerMap(d.responseHeaders);
  const ct = (h['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (ct.includes('mpegurl') || HLS_EXT.test(u.pathname)) return { kind: 'hls', mime: ct || 'application/vnd.apple.mpegurl' };
  if (SEGMENT_EXT.test(u.pathname) || ct === 'video/mp2t' || ct === 'video/iso.segment' || ct.includes('dash+xml')) return null;
  const typed = ct.startsWith('video/') || ct.startsWith('audio/');
  const byExt = MEDIA_EXT.test(u.pathname) && (!ct || ct === 'application/octet-stream' || ct === 'binary/octet-stream');
  if (!typed && !byExt) return null;
  const total = /\/(\d+)\s*$/.exec(h['content-range'] || '');
  const size = total ? +total[1] : h['content-length'] ? +h['content-length'] : null;
  if (size != null && size < MIN_FILE) return null;
  return { kind: 'file', mime: ct, size };
}

// Per-tab media lists live in memory and are mirrored to storage.session so a
// restarted service worker still knows what each tab played.
const tabs = new Map();
function tabState(tabId) {
  if (!tabs.has(tabId)) {
    tabs.set(
      tabId,
      chrome.storage.session.get(`tab:${tabId}`).then((s) => ({ items: new Map((s[`tab:${tabId}`] || []).map((i) => [i.url, i])) })),
    );
  }
  return tabs.get(tabId);
}
const saveTimers = new Map();
function persist(tabId, st) {
  clearTimeout(saveTimers.get(tabId));
  saveTimers.set(tabId, setTimeout(() => chrome.storage.session.set({ [`tab:${tabId}`]: [...st.items.values()] }), 300));
}
function clearTab(tabId) {
  tabs.delete(tabId);
  chrome.storage.session.remove(`tab:${tabId}`);
  chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
}

// Referer/Origin of the request that fetched the media; many CDNs check them.
const reqHeaders = new Map();
chrome.webRequest.onSendHeaders.addListener(
  (d) => {
    const h = headerMap(d.requestHeaders);
    reqHeaders.set(d.requestId, { referer: h.referer, origin: h.origin });
    if (reqHeaders.size > 500) reqHeaders.delete(reqHeaders.keys().next().value);
  },
  { urls: ['<all_urls>'], types: ['media', 'xmlhttprequest', 'other', 'object'] },
  ['requestHeaders', 'extraHeaders'],
);

chrome.webRequest.onHeadersReceived.addListener(
  (d) => {
    if (d.tabId < 0) return;
    const found = classify(d);
    if (!found) return;
    const sent = reqHeaders.get(d.requestId) || {};
    record(d.tabId, { url: d.url, ...found, referer: sent.referer || d.initiator, frameUrl: d.documentUrl || d.initiator });
  },
  { urls: ['<all_urls>'], types: ['media', 'xmlhttprequest', 'other', 'object'] },
  ['responseHeaders'],
);

async function record(tabId, item) {
  const st = await tabState(tabId);
  const prev = st.items.get(item.url);
  if (prev) {
    if (item.size && !prev.size) prev.size = item.size;
    return;
  }
  item.seenAt = Date.now();
  st.items.set(item.url, item);
  persist(tabId, st);
  if (item.kind === 'hls') probe(tabId, item);
  updateBadge(tabId);
}

// Minimal HLS reader: enough to list qualities and spot encrypted or live playlists.
// Runs in the extension so the menu works whichever download manager is selected.
function parsePlaylist(text, base) {
  if (!text.trimStart().startsWith('#EXTM3U')) throw new Error('Not an HLS playlist');
  const attrs = (l) => Object.fromEntries([...l.matchAll(/([A-Z0-9-]+)=("([^"]*)"|[^,]*)/g)].map((m) => [m[1], m[3] ?? m[2]]));
  const out = { variants: [], children: [], encrypted: false, endList: false, segments: 0, duration: 0 };
  let inf = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXT-X-STREAM-INF:')) inf = attrs(line.slice(18));
    else if (line.startsWith('#EXT-X-MEDIA:')) {
      const a = attrs(line.slice(13));
      if (a.URI) out.children.push(new URL(a.URI, base).href);
    } else if (/^#EXT-X-(SESSION-)?KEY:/.test(line)) {
      if ((attrs(line.slice(line.indexOf(':') + 1)).METHOD ?? 'NONE') !== 'NONE') out.encrypted = true;
    } else if (line.startsWith('#EXTINF:')) out.duration += parseFloat(line.slice(8)) || 0;
    else if (line === '#EXT-X-ENDLIST') out.endList = true;
    else if (!line.startsWith('#')) {
      const url = new URL(line, base).href;
      if (inf) {
        const bw = Number(inf['AVERAGE-BANDWIDTH'] ?? inf.BANDWIDTH ?? 0);
        const h = inf.RESOLUTION?.split('x')[1];
        out.variants.push({ url, bandwidth: bw, resolution: inf.RESOLUTION, label: `${h ? h + 'p' : 'audio/other'} · ${(bw / 1e6).toFixed(1)} Mbps` });
        out.children.push(url);
        inf = null;
      } else out.segments++;
    }
  }
  out.variants.sort((a, b) => b.bandwidth - a.bandwidth);
  return out.variants.length
    ? { kind: 'master', encrypted: out.encrypted, variants: out.variants, children: out.children }
    : { kind: 'media', encrypted: out.encrypted, live: !out.endList, segments: out.segments, duration: Math.round(out.duration) };
}

async function probe(tabId, item) {
  if (item.probe || item.probing) return;
  item.probing = true;
  try {
    const res = await fetch(item.url, { credentials: 'include', signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    item.probe = parsePlaylist(await res.text(), res.url);
  } catch (e) {
    item.probeError = String(e.message || e);
  } finally {
    item.probing = false;
    const st = await tabState(tabId);
    persist(tabId, st);
    updateBadge(tabId);
  }
}

async function visibleItems(tabId) {
  const st = await tabState(tabId);
  const all = [...st.items.values()];
  // A master playlist lists its variant/audio playlists; offer the master's choices instead of the children.
  const children = new Set(all.flatMap((i) => i.probe?.children || []));
  return all.filter((i) => !children.has(i.url));
}

async function updateBadge(tabId) {
  const n = (await visibleItems(tabId)).length;
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#6366f1' }).catch(() => {});
  chrome.action.setBadgeText({ tabId, text: n ? String(n) : '' }).catch(() => {});
}

chrome.webRequest.onBeforeRequest.addListener((d) => clearTab(d.tabId), { urls: ['<all_urls>'], types: ['main_frame'] });
chrome.tabs.onRemoved.addListener(clearTab);

// --------------------------------------------------------------- menu entries

const fmtSize = (n) => (n == null ? '' : n > 1 << 30 ? (n / (1 << 30)).toFixed(2) + ' GB' : n > 1 << 20 ? (n / (1 << 20)).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB');
const fmtDur = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');
const baseName = (url) => decodeURIComponent(new URL(url).pathname.split('/').pop() || '');

/** Flattens tab items into the rows the overlay and popup show. */
async function entries(tabId) {
  const out = [];
  for (const it of await visibleItems(tabId)) {
    if (it.kind === 'file') {
      const ext = (baseName(it.url).match(/\.([a-z0-9]+)$/i)?.[1] || it.mime.split('/')[1] || 'file').toUpperCase();
      out.push({ url: it.url, kind: 'file', label: `${ext} file`, sub: [fmtSize(it.size), baseName(it.url)].filter(Boolean).join(' · '), size: it.size || 0 });
    } else if (it.probe?.encrypted) {
      out.push({ url: it.url, kind: 'blocked', label: 'Encrypted stream', sub: 'Protected with keys/DRM — Harbor will not download it' });
    } else if (it.probe?.kind === 'master') {
      for (const v of it.probe.variants) out.push({ url: it.url, variant: v.url, kind: 'hls', label: `HLS ${v.label}`, sub: baseName(it.url), size: v.bandwidth });
    } else if (it.probe?.kind === 'media') {
      if (it.probe.live) out.push({ url: it.url, kind: 'blocked', label: 'Live stream', sub: 'Only finished (on-demand) streams are supported' });
      else out.push({ url: it.url, kind: 'hls', label: 'HLS stream', sub: [fmtDur(it.probe.duration), `${it.probe.segments} segments`].filter(Boolean).join(' · '), size: 0 });
    } else {
      out.push({ url: it.url, kind: 'hls', label: 'HLS stream', sub: it.probeError ? 'Could not read playlist' : baseName(it.url), size: 0 });
    }
  }
  return out.sort((a, b) => (a.kind === 'blocked') - (b.kind === 'blocked') || b.size - a.size);
}

// ------------------------------------------------------------------ hand-off

async function headersFor(url, referer) {
  const headers = { 'user-agent': navigator.userAgent };
  if (referer) headers.referer = referer;
  try {
    const cookies = await chrome.cookies.getAll({ url });
    if (cookies.length) headers.cookie = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  } catch {}
  return headers;
}

function nameFromTitle(title, ext) {
  const t = (title || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  return t ? `${t}.${ext}` : undefined;
}

/** The Harbor engine's /ping (null when it isn't running). */
async function engineInfo() {
  try {
    return await engine('GET', '/ping', undefined, 1500);
  } catch {
    return null;
  }
}

// @ytdlp:start  (everything up to @ytdlp:end is stripped from the store build by scripts/build.ts)
// ------------------------------------------------------------------ yt-dlp
// Sites where the player streams protected chunks (YouTube, Instagram, ...) are handed to
// yt-dlp, which runs inside the Harbor engine. Added at the project owner's request;
// it needs Harbor running with yt-dlp installed, whichever download target is selected.

const YTDLP_SITES = /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com|instagram\.com|facebook\.com|fb\.watch|x\.com|twitter\.com|tiktok\.com|vimeo\.com|dailymotion\.com|reddit\.com|twitch\.tv|soundcloud\.com|bilibili\.com|streamable\.com|threads\.net|pinterest\.com|linkedin\.com)$/i;
const ytdlpCache = new Map(); // page URL -> { at, result }

async function pageCookies(pageUrl) {
  try {
    return (await chrome.cookies.getAll({ url: pageUrl })).map((c) => ({
      domain: c.domain, hostOnly: c.hostOnly, path: c.path, secure: c.secure, expirationDate: c.expirationDate, name: c.name, value: c.value,
    }));
  } catch {
    return [];
  }
}

/** Should the menu ask yt-dlp about this page? Known sites always; elsewhere only when nothing else was found. */
async function ytdlpWanted(pageUrl, haveUsable) {
  const c = await cfg();
  if (!c.ytdlp || !/^https?:/i.test(pageUrl || '')) return false;
  return YTDLP_SITES.test(new URL(pageUrl).hostname) || !haveUsable;
}

async function ytdlpEntries(pageUrl) {
  const hit = ytdlpCache.get(pageUrl);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.result;
  const info = await engineInfo();
  if (!info) return { error: 'Downloads from this site need Harbor running. Start it, then try again.' };
  if (!info.ytdlp) return { error: "Video-site support isn't set up on this PC yet." };
  const known = YTDLP_SITES.test(new URL(pageUrl).hostname);
  let p;
  try {
    p = await engine('POST', '/ytdlp/probe', { url: pageUrl, cookies: await pageCookies(pageUrl) }, 95_000);
  } catch (e) {
    const msg = String(e.message || e);
    // On unknown sites a failed probe just means "nothing for yt-dlp here".
    return { error: known ? msg : null };
  }
  if (p.drm) return { error: 'This video is DRM-protected; it cannot be downloaded.' };
  const result = {
    title: p.title,
    entries: p.choices.map((c) => ({
      kind: 'ytdlp', url: pageUrl, label: c.label, sub: [c.approxSize ? '~' + fmtSize(c.approxSize) : '', p.extractor].filter(Boolean).join(' · '),
      format: c.format, audioOnly: c.audioOnly, approxSize: c.approxSize, title: p.title,
    })),
  };
  ytdlpCache.set(pageUrl, { at: Date.now(), result });
  if (ytdlpCache.size > 50) ytdlpCache.delete(ytdlpCache.keys().next().value);
  return result;
}

async function sendToYtdlp({ url, format, label, audioOnly, approxSize, title }) {
  return engine('POST', '/downloads', {
    url, kind: 'ytdlp', pageUrl: url, start: 'now', fileName: title,
    ytdlp: { format, label, audioOnly, approxSize, cookies: await pageCookies(url) },
  });
}

// @ytdlp:end

async function sendToEngine({ url, kind, variant, title, pageUrl, referer, fileName }) {
  if (kind === 'blocked') throw new Error('This stream is protected and cannot be downloaded.');
  const { target } = await cfg();
  if (target === 'abdm') {
    // AB DM takes a media playlist for HLS, so send the chosen quality's playlist.
    const link = variant || url;
    const hls = kind === 'hls';
    let suggestedName = fileName;
    if (!suggestedName && (hls || !/\.[a-z0-9]{2,5}$/i.test(baseName(url)))) suggestedName = nameFromTitle(title, 'mp4');
    await abdm('add', {
      items: [{ type: hls ? 'hls' : 'http', link, headers: await headersFor(link, referer || pageUrl), downloadPage: pageUrl || null, suggestedName: suggestedName || null, description: title || null }],
      options: { silentAdd: false, silentStart: false },
    });
    return { id: null, fileName: suggestedName };
  }
  const req = { url, kind: kind === 'hls' ? 'hls' : 'file', variant, pageUrl, start: 'now', headers: await headersFor(variant || url, referer || pageUrl) };
  if (fileName) req.fileName = fileName;
  else if (kind === 'hls') req.fileName = nameFromTitle(title, 'mp4');
  else if (!/\.[a-z0-9]{2,5}$/i.test(baseName(url))) req.fileName = nameFromTitle(title, 'mp4');
  return engine('POST', '/downloads', req);
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  (async () => {
    const tabId = msg.tabId ?? sender.tab?.id;
    switch (msg.type) {
      case 'list': {
        const [up, { target }] = await Promise.all([targetUp(), cfg()]);
        // Playlists whose quality list could not be read yet get another try.
        const st = await tabState(tabId);
        await Promise.all([...st.items.values()].filter((i) => i.kind === 'hls' && !i.probe).map((i) => probe(tabId, i)));
        const list = await entries(tabId);
        const usable = list.some((e) => e.kind !== 'blocked');
        return { engine: up, targetName: TARGET_NAMES[target], entries: list, ytdlp: await ytdlpWanted(msg.pageUrl, usable || msg.hasSrc) }; // @store-replace: return { engine: up, targetName: TARGET_NAMES[target], entries: list };
      }
      case 'ytdlp-list': // @ytdlp-line
        return ytdlpEntries(msg.pageUrl); // @ytdlp-line
      case 'download': {
        const st = await tabState(tabId);
        const it = st.items.get(msg.url);
        const rec = msg.kind === 'ytdlp' ? await sendToYtdlp(msg) : await sendToEngine({ ...msg, referer: it?.referer }); // @store-replace: const rec = await sendToEngine({ ...msg, referer: it?.referer });
        return { ok: true, id: rec.id, fileName: rec.fileName };
      }
      case 'status': {
        const c = await cfg();
        const info = await engineInfo();
        return { engine: await targetUp(), targetName: TARGET_NAMES[c.target], ytdlpVersion: info?.ytdlp ?? null, fetchlineUp: !!info, ...c }; // @store-replace: return { engine: await targetUp(), targetName: TARGET_NAMES[c.target], fetchlineUp: !!info, ...c };
      }
      default:
        return { error: 'unknown message' };
    }
  })()
    .then(reply)
    .catch((e) => reply({ error: String(e.message || e) }));
  return true;
});

// ---------------------------------------------------------- context menu

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'fl-link', title: 'Download link with Harbor', contexts: ['link'] });
  chrome.contextMenus.create({ id: 'fl-media', title: 'Download media with Harbor', contexts: ['video', 'audio'] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = info.menuItemId === 'fl-link' ? info.linkUrl : info.srcUrl;
  try {
    if (!url || !/^https?:/i.test(url)) throw new Error('This media has no direct address (it is streamed). Use the button on the video instead.');
    const kind = HLS_EXT.test(new URL(url).pathname) ? 'hls' : 'file';
    await sendToEngine({ url, kind, title: tab?.title, pageUrl: info.pageUrl });
  } catch (e) {
    notifyTab(tab?.id, String(e.message || e));
  }
});

function notifyTab(tabId, text) {
  if (tabId == null) return;
  chrome.tabs.sendMessage(tabId, { type: 'toast', text }).catch(() => {});
}

// ------------------------------------------------- browser download takeover

chrome.downloads.onCreated.addListener(async (item) => {
  const { takeover } = await cfg();
  if (!takeover || item.byExtensionId || !/^https?:/i.test(item.finalUrl || item.url)) return;
  if (!(await targetUp())) return; // download manager not running: let the browser handle it
  try {
    // Hand off first; only cancel the browser's copy once Harbor has accepted it.
    const url = item.finalUrl || item.url;
    await sendToEngine({ url, kind: HLS_EXT.test(new URL(url).pathname) ? 'hls' : 'file', referer: item.referrer, pageUrl: item.referrer });
    await chrome.downloads.cancel(item.id);
    await chrome.downloads.erase({ id: item.id });
  } catch (e) {
    console.warn('Harbor takeover failed', e);
  }
});

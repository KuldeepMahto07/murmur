// Fetchline Integration — floating "Download" button over videos.
//
// Shows when the pointer is over a sizeable <video>/<audio> (or when one starts
// playing). Clicking opens a menu of the media this tab has loaded; choosing an
// entry hands it to Fetchline. All UI lives in a closed shadow root so page CSS
// and scripts cannot restyle or read it.
(() => {
  if (window.__fetchlineLoaded) return;
  window.__fetchlineLoaded = true;

  const MIN_W = 160;
  const MIN_H = 90;

  const host = document.createElement('fetchline-overlay');
  host.style.cssText = 'all:initial;position:fixed;inset:0 auto auto 0;width:0;height:0;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'closed' });
  window.__fetchlineRoot = root; // isolated world only (not visible to the page); used by the automated test
  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font: 13px/1.35 system-ui, 'Segoe UI', sans-serif; }
      .fab {
        position: fixed; display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px 0 9px;
        border: 0; border-radius: 15px; cursor: pointer; color: #fff; font-weight: 600; letter-spacing: .2px;
        background: linear-gradient(135deg, #14b8a6, #6366f1); box-shadow: 0 4px 14px rgba(0,0,0,.35);
        opacity: 0; transform: translateY(-4px); transition: opacity .15s, transform .15s; pointer-events: none;
      }
      .fab.on { opacity: .96; transform: none; pointer-events: auto; }
      .fab:hover { opacity: 1; }
      .fab svg { width: 15px; height: 15px; }
      .menu {
        position: fixed; width: 330px; max-height: 360px; overflow: auto; padding: 6px; border-radius: 12px;
        background: #151a23; color: #e6eaf2; border: 1px solid #2a3344; box-shadow: 0 12px 34px rgba(0,0,0,.45);
      }
      .menu[hidden], .fab[hidden] { display: none; }
      .head { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px 8px; color: #8a94a8; font-size: 12px; }
      .head b { color: #e6eaf2; font-size: 13px; }
      .x { background: none; border: 0; color: #8a94a8; cursor: pointer; font-size: 15px; }
      .row { display: block; width: 100%; text-align: left; background: none; border: 0; color: inherit; padding: 8px 10px; border-radius: 8px; cursor: pointer; }
      .row:hover { background: #222a39; }
      .row .l { font-weight: 600; }
      .row .s { color: #8a94a8; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .row.blocked { cursor: default; opacity: .7; }
      .row.blocked:hover { background: none; }
      .row.sent .l::after { content: '  ✓ sent'; color: #34d399; font-weight: 500; }
      .note { padding: 10px; color: #c3cad8; }
      .note.warn { color: #fbbf24; }
      .toast { position: fixed; right: 16px; bottom: 16px; max-width: 360px; padding: 10px 14px; border-radius: 10px; background: #151a23; color: #e6eaf2; border: 1px solid #2a3344; box-shadow: 0 8px 24px rgba(0,0,0,.4); }
    </style>
    <button class="fab" part="fab" title="Download with Fetchline">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v9M4 7.5 8 11.5l4-4M3 14h10"/></svg>
      <span>Download</span>
    </button>
    <div class="menu" hidden></div>
    <div class="toast" hidden></div>`;

  const fab = root.querySelector('.fab');
  const menu = root.querySelector('.menu');
  const toastEl = root.querySelector('.toast');
  let target = null;
  let hideTimer = 0;
  let pointerInUi = false;

  const mount = () => document.documentElement.appendChild(host);
  if (document.documentElement) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });

  // --------------------------------------------------------------- targeting

  function mediaElements() {
    return [...document.querySelectorAll('video, audio')];
  }

  function bigEnough(el) {
    const r = el.getBoundingClientRect();
    return r.width >= MIN_W && r.height >= MIN_H && getComputedStyle(el).visibility !== 'hidden';
  }

  function mediaAt(x, y) {
    // Players often cover the <video> with their own controls, so hit-test by geometry, not event target.
    for (const el of mediaElements()) {
      if (!bigEnough(el)) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return el;
    }
    return null;
  }

  function place() {
    if (!target || !target.isConnected) return hide(true);
    const r = target.getBoundingClientRect();
    const w = fab.offsetWidth || 110;
    const left = Math.min(window.innerWidth - w - 8, Math.max(8, r.right - w - 10));
    const top = Math.min(window.innerHeight - 40, Math.max(8, r.top + 10));
    fab.style.left = `${left}px`;
    fab.style.top = `${top}px`;
    menu.style.left = `${Math.min(window.innerWidth - 338, Math.max(8, left + w - 330))}px`;
    menu.style.top = `${top + 36}px`;
  }

  function show(el) {
    clearTimeout(hideTimer);
    if (target !== el) closeMenu();
    target = el;
    place();
    fab.classList.add('on');
  }

  function hide(now = false) {
    clearTimeout(hideTimer);
    const go = () => {
      if (pointerInUi || !menu.hidden) return;
      fab.classList.remove('on');
      target = null;
    };
    if (now) go();
    else hideTimer = setTimeout(go, 1200);
  }

  let lastMove = 0;
  document.addEventListener(
    'mousemove',
    (e) => {
      const now = performance.now();
      if (now - lastMove < 60) return;
      lastMove = now;
      const el = mediaAt(e.clientX, e.clientY);
      if (el) show(el);
      else if (target) hide();
    },
    { capture: true, passive: true },
  );

  // A video that starts playing gets the button briefly even without hovering.
  document.addEventListener(
    'play',
    (e) => {
      const el = e.target;
      if (!(el instanceof HTMLMediaElement) || !bigEnough(el)) return;
      show(el);
      hide();
    },
    true,
  );

  addEventListener('scroll', () => target && place(), { capture: true, passive: true });
  addEventListener('resize', () => target && place(), { passive: true });
  for (const el of [fab, menu]) {
    el.addEventListener('mouseenter', () => ((pointerInUi = true), clearTimeout(hideTimer)));
    el.addEventListener('mouseleave', () => ((pointerInUi = false), hide()));
  }

  // -------------------------------------------------------------------- menu

  fab.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    menu.hidden ? openMenu() : closeMenu();
  });

  document.addEventListener('keydown', (e) => e.key === 'Escape' && closeMenu(), true);
  document.addEventListener('mousedown', (e) => !e.composedPath().includes(host) && closeMenu(), true);

  function closeMenu() {
    menu.hidden = true;
    menu.textContent = '';
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  async function openMenu() {
    menu.hidden = false;
    menu.innerHTML = `<div class="head"><b>Fetchline</b><button class="x" title="Close">✕</button></div><div class="note">Looking for media on this page…</div>`;
    menu.querySelector('.x').onclick = closeMenu;
    place();

    if (target?.mediaKeys) {
      return note('This video is protected with DRM. Fetchline does not download protected media.', true);
    }

    let res;
    try {
      const hasSrc = /^https?:/i.test(target?.currentSrc || target?.src || '');
      res = await chrome.runtime.sendMessage({ type: 'list', pageUrl: location.href, hasSrc });
    } catch {
      return note('The extension was updated — reload this page.', true);
    }
    if (res?.error) return note(res.error, true);
    if (!res.engine && !res.ytdlp) { // @store-replace: if (!res.engine) {
      return note(
        res.targetName === 'AB Download Manager'
          ? 'AB Download Manager is not running (or its browser integration is off). Start it, then try again.'
          : 'Fetchline is not running. Start it (start.bat), then try again.',
        true,
      );
    }

    const rows = [...res.entries];
    // The element's own address, if it is a plain URL the network sniffer did not already list.
    const src = target?.currentSrc || target?.src || '';
    if (/^https?:/i.test(src) && !rows.some((r) => r.url === src)) {
      rows.unshift({ url: src, kind: /\.m3u8?(\?|$)/i.test(src) ? 'hls' : 'file', label: 'This video', sub: decodeURIComponent(new URL(src).pathname.split('/').pop() || src) });
    }
    const emptyText = src.startsWith('blob:')
      ? 'No downloadable stream seen yet. Play the video for a few seconds and try again.'
      : 'No downloadable media seen on this page yet. Start playback and try again.';
    if (!res.engine) rows.length = 0; // target app down: only yt-dlp (via Fetchline) can help // @store-replace: if (!res.engine) rows.length = 0;
    if (!rows.length && !res.ytdlp) return note(emptyText); // @store-replace: if (!rows.length) return note(emptyText);

    const noteEl = menu.querySelector('.note');
    if (rows.length) noteEl.remove();
    rows.forEach(addRow);
    // @ytdlp:start  (stripped from the store build by scripts/build.ts)
    if (!res.ytdlp) return;

    // Ask yt-dlp (through Fetchline) for this page's qualities; this can take a few seconds.
    const wait = document.createElement('div');
    wait.className = 'note';
    wait.textContent = 'Checking with yt-dlp…';
    menu.appendChild(wait);
    const forUrl = location.href;
    const y = await chrome.runtime.sendMessage({ type: 'ytdlp-list', pageUrl: forUrl }).catch((e) => ({ error: String(e) }));
    if (menu.hidden || location.href !== forUrl) return;
    if (y?.entries?.length) {
      wait.remove();
      noteEl.isConnected && noteEl.remove();
      y.entries.forEach(addRow);
    } else if (y?.error) {
      wait.textContent = y.error;
      wait.classList.add('warn');
      noteEl.isConnected && noteEl.remove();
    } else {
      wait.remove();
      if (!rows.length) note(emptyText);
    }
    // @ytdlp:end
  }

  function addRow(r) {
    const b = document.createElement('button');
    b.className = `row ${r.kind === 'blocked' ? 'blocked' : ''}`;
    b.innerHTML = `<div class="l">${esc(r.label)}</div><div class="s">${esc(r.sub || '')}</div>`;
    if (r.kind !== 'blocked') b.onclick = () => send(r, b);
    menu.appendChild(b);
  }

  function note(text, warn = false) {
    const n = menu.querySelector('.note');
    n.textContent = text;
    n.classList.toggle('warn', warn);
  }

  async function send(row, button) {
    button.disabled = true;
    const res = await chrome.runtime
      .sendMessage({ type: 'download', url: row.url, kind: row.kind, variant: row.variant, format: row.format, label: row.label, audioOnly: row.audioOnly, approxSize: row.approxSize, title: row.title || document.title, pageUrl: location.href })
      .catch((e) => ({ error: String(e) }));
    button.disabled = false;
    if (res?.error) return toast(res.error);
    button.classList.add('sent');
    setTimeout(closeMenu, 1200);
  }

  let toastTimer = 0;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), 4500);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'toast' && window === window.top) toast(`Fetchline: ${msg.text}`);
  });
})();

const $ = (s, el = document) => el.querySelector(s);
const state = { snap: null, view: 'all', selected: new Set(), focus: null, sort: { key: 'addedAt', asc: false }, filter: '' };

// ------------------------------------------------------------------ api

async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-fetchline': '1' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function connect() {
  const es = new EventSource('/api/events');
  es.onmessage = (e) => {
    state.snap = JSON.parse(e.data);
    render();
  };
  es.onerror = () => {
    es.close();
    toast('Engine disconnected — retrying…');
    setTimeout(connect, 2000);
  };
}

// --------------------------------------------------------------- format

const units = ['B', 'KB', 'MB', 'GB', 'TB'];
function bytes(n) {
  if (n == null) return '—';
  let i = 0;
  while (n >= 1024 && i < units.length - 1) (n /= 1024), i++;
  return `${n.toFixed(i && n < 100 ? 1 : 0)} ${units[i]}`;
}
function dur(s) {
  if (!isFinite(s) || s <= 0) return '';
  if (s < 60) return `${Math.ceil(s)} s`;
  if (s < 3600) return `${Math.floor(s / 60)} m ${Math.round(s % 60)} s`;
  return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} m`;
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function when(t) {
  const d = new Date(t);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString();
}
const progress = (d) => d.progress ?? (d.size ? d.downloaded / d.size : d.status === 'completed' ? 1 : 0);
const eta = (d) => {
  const p = progress(d);
  return d.speed > 0 && p > 0 ? (d.downloaded / p - d.downloaded) / d.speed : Infinity;
};
const STATUS = { queued: 'Queued', downloading: 'Downloading', paused: 'Paused', verifying: 'Verifying', completed: 'Complete', error: 'Error' };

// --------------------------------------------------------------- icons
// Harbor's own line icons (24-unit grid, drawn for this app; no third-party symbol sets).

const P = (d) => `<path d="${d}"/>`;
const C = (cx, cy, r, fill = false) => `<circle cx="${cx}" cy="${cy}" r="${r}"${fill ? ' fill="currentColor" stroke="none"' : ''}/>`;
const svg = (inner) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
const I = {
  plus: svg(P('M12 5v14M5 12h14')),
  play: svg(P('M8 5.5v13l10.5-6.5z')),
  pause: svg(P('M9 5.5v13M15 5.5v13')),
  pauseAll: svg(C(12, 12, 9) + P('M9.5 9.5h5v5h-5z')),
  trash: svg(P('M4.5 7h15M10 11v6M14 11v6M6.5 7l.9 11.2A2 2 0 0 0 9.4 20h5.2a2 2 0 0 0 2-1.8L17.5 7M9.5 7V4.5h5V7')),
  queue: svg(P('M4 6.5h11M4 12h7M4 17.5h7M15 13v6l5-3z')),
  stopQueue: svg(P('M4 6.5h11M4 12h7M4 17.5h7M15.5 13.5h4.5v4.5h-4.5z')),
  gear: svg(P('M4 7.5h9M17 7.5h3M4 16.5h3M11 16.5h9') + C(15, 7.5, 2) + C(9, 16.5, 2)),
  themeAuto: svg(C(12, 12, 8) + '<path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>'),
  themeLight: svg(C(12, 12, 4) + P('M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4')),
  themeDark: svg(P('M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z')),
  search: svg(C(11, 11, 6.5) + P('M20 20l-4.3-4.3')),
  xmark: svg(P('M7 7l10 10M17 7L7 17')),
  arrowDownCircle: svg(C(12, 12, 9) + P('M12 7.5v9M8 12.5l4 4 4-4')),
  arrowDown: svg(P('M12 4.5v14M6.5 13l5.5 5.5 5.5-5.5')),
  bolt: svg(P('M13 3L5.5 13H11l-1 8 7.5-10H12z')),
  clock: svg(C(12, 12, 8.5) + P('M12 7.5V12l3 2')),
  check: svg(P('M5 12.5l4.5 4.5L19 7.5')),
  list: svg(P('M9 6.5h11M9 12h11M9 17.5h11') + C(4.8, 6.5, 1.1, true) + C(4.8, 12, 1.1, true) + C(4.8, 17.5, 1.1, true)),
  archive: svg(P('M3.5 5.5h17v4h-17zM5 9.5v9.5h14V9.5M10 13.5h4')),
  doc: svg(P('M7 3h7l5 5v13H7zM14 3v5h5M9.5 13h7M9.5 16.5h5')),
  music: svg(P('M9 17.5V6l10-2v11.5') + C(7, 17.5, 2) + C(17, 15.5, 2)),
  app: svg(P('M5 5h5.5v5.5H5zM13.5 5H19v5.5h-5.5zM5 13.5h5.5V19H5zM13.5 13.5H19V19h-5.5z')),
  film: svg(P('M4 5h16v14H4zM8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4')),
  photo: svg(P('M4 5.5h16v13H4zM4 15.5l4.5-4.5 4 4 2.5-2.5 5 5') + C(15.5, 9.5, 1.5)),
  folder: svg(P('M3.5 7.5a2 2 0 0 1 2-2h3.8l2 2h7.2a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z')),
  sparkle: svg(P('M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1-5.1-1.9 5.1-1.9zM18.5 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z')),
};
for (const el of document.querySelectorAll('[data-icon]')) el.insertAdjacentHTML('afterbegin', I[el.dataset.icon] ?? '');

// Sidebar entries: icon + iOS system color per view and category.
const LOOK = {
  all: ['arrowDown', 'var(--tint)'],
  active: ['bolt', 'var(--green)'],
  unfinished: ['clock', 'var(--orange)'],
  finished: ['check', 'var(--teal)'],
  queue: ['list', 'var(--indigo)'],
  Archives: ['archive', 'var(--brown)'],
  Documents: ['doc', 'var(--tint)'],
  Music: ['music', 'var(--pink)'],
  Programs: ['app', 'var(--gray)'],
  Video: ['film', 'var(--purple)'],
  Images: ['photo', 'var(--green)'],
  General: ['folder', 'var(--teal)'],
  Custom: ['folder', 'var(--yellow)'],
};
const look = (key) => LOOK[key] ?? ['folder', 'var(--gray)'];

// ------------------------------------------------------------- sidebar

const VIEWS = [
  ['all', 'All downloads', () => true],
  ['active', 'Active', (d) => d.status === 'downloading' || d.status === 'verifying'],
  ['unfinished', 'Unfinished', (d) => d.status !== 'completed'],
  ['finished', 'Finished', (d) => d.status === 'completed'],
  ['queue', 'Queue', (d) => d.inQueue],
];
function viewFilter() {
  if (state.view.startsWith('cat:')) {
    const c = state.view.slice(4);
    return (d) => d.category === c;
  }
  return (VIEWS.find((v) => v[0] === state.view) ?? VIEWS[0])[2];
}

function renderSidebar() {
  const ds = state.snap.downloads;
  const link = (key, lookKey, label, n) => {
    const [icon, color] = look(lookKey);
    return `<a data-view="${esc(key)}" class="${state.view === key ? 'on' : ''}"><span class="sq" style="--c:${color}">${I[icon]}</span><span class="lbl">${esc(label)}</span><span class="n">${n || ''}</span></a>`;
  };
  let html = '<h5>Library</h5>' + VIEWS.map(([k, l, f]) => link(k, k, l, ds.filter(f).length)).join('');
  const cats = [...state.snap.settings.categories.map((c) => c.name), 'General', 'Custom'];
  html += '<h5>Categories</h5>' + cats.map((c) => link('cat:' + c, c, c, ds.filter((d) => d.category === c).length)).join('');
  const sb = $('#sidebar');
  if (sb.innerHTML !== html) sb.innerHTML = html; // avoid needless re-layout every tick

  const title = state.view.startsWith('cat:') ? state.view.slice(4) : (VIEWS.find((v) => v[0] === state.view) ?? VIEWS[0])[1];
  $('#view-title').textContent = title.replace(/^All downloads$/, 'All Downloads');

  const lic = state.snap.license;
  const chip = $('#side-pro');
  if (lic) {
    chip.classList.toggle('is-pro', !!lic.pro);
    chip.innerHTML =
      lic.tier === 'pro'
        ? `<b>Harbor Pro</b><span>${esc(lic.email ?? '')}</span>`
        : lic.tier === 'trial'
          ? `<b>Pro Trial</b><span>${lic.trialDaysLeft} day${lic.trialDaysLeft === 1 ? '' : 's'} left</span>`
          : `<b>Harbor Free</b><span>${lic.trialAvailable ? 'Try Pro free for 14 days' : 'Upgrade to Pro'}</span>`;
  }
}
$('#side-pro').onclick = () => $('#btn-settings').click();

// ---------------------------------------------------------------- table

function sorted(list) {
  const { key, asc } = state.sort;
  const val = (d) => (key === 'progress' ? progress(d) : key === 'eta' ? eta(d) : d[key] ?? '');
  return list.sort((a, b) => {
    const x = val(a), y = val(b);
    const c = typeof x === 'string' ? x.localeCompare(y) : x - y;
    return asc ? c : -c;
  });
}

function renderTable() {
  const f = viewFilter();
  const q = state.filter.toLowerCase();
  const rows = sorted(state.snap.downloads.filter((d) => f(d) && (!q || d.fileName.toLowerCase().includes(q) || d.url.toLowerCase().includes(q))));
  $('#list tbody').innerHTML = rows
    .map((d) => {
      const p = progress(d);
      const ext = (d.fileName.match(/\.([a-z0-9]{1,5})$/i) || [])[1] || '';
      const kindTag = d.kind === 'hls' ? ' · HLS' : d.kind === 'ytdlp' ? ' · video site' : '';
      const status = d.status === 'error' ? `Error: ${d.error}` : d.status === 'downloading' ? `${STATUS[d.status]} · ${d.activeConnections.length} conn` : STATUS[d.status];
      return `<tr data-id="${d.id}" class="${state.selected.has(d.id) ? 'sel' : ''}">
        <td class="name" title="${esc(d.url)}"><span class="ficon" style="--c:${look(d.category)[1]}">${esc(ext.slice(0, 4))}</span>${esc(d.fileName)}</td>
        <td class="narrow">${d.inQueue ? '●' : ''}</td>
        <td class="num">${bytes(d.size)}</td>
        <td><span class="bar"><i style="width:${(p * 100).toFixed(1)}%"></i></span><span class="pct">${(p * 100).toFixed(1)}%</span></td>
        <td class="num">${d.speed > 0 ? bytes(d.speed) + '/s' : ''}</td>
        <td class="num">${d.status === 'downloading' ? dur(eta(d)) : ''}</td>
        <td><span class="st ${d.status}" title="${esc(d.error ?? '')}">${esc(status + kindTag)}</span></td>
        <td class="muted">${when(d.addedAt)}</td>
      </tr>`;
    })
    .join('');
  $('#empty').classList.toggle('hidden', rows.length > 0);
  document.querySelectorAll('#list th').forEach((th) => {
    th.classList.toggle('sorted', th.dataset.sort === state.sort.key);
    th.classList.toggle('asc', state.sort.asc);
  });
  const active = state.snap.downloads.filter((d) => d.status === 'downloading');
  const speed = active.reduce((n, d) => n + d.speed, 0);
  $('#totals').textContent = `${active.length} active · ${bytes(speed)}/s` + (state.snap.queueRunning ? ' · queue running' : '');
}

function renderToolbar() {
  const sel = [...state.selected].map((id) => state.snap.downloads.find((d) => d.id === id)).filter(Boolean);
  $('#btn-resume').disabled = !sel.some((d) => ['paused', 'error', 'queued'].includes(d.status));
  $('#btn-pause').disabled = !sel.some((d) => ['downloading', 'queued'].includes(d.status));
  $('#btn-delete').disabled = !sel.length;
  const q = $('#btn-queue');
  const running = !!state.snap.queueRunning;
  if (q.dataset.running !== String(running)) {
    q.dataset.running = String(running);
    q.innerHTML = running ? I.stopQueue : I.queue;
    q.title = q.ariaLabel = running ? 'Stop queue' : 'Start queue';
    q.classList.toggle('on', running);
  }
}

// -------------------------------------------------------------- details

let detailsFor = null;
function renderDetails() {
  const d = state.snap.downloads.find((x) => x.id === state.focus);
  $('#details').classList.toggle('hidden', !d);
  if (!d) return;
  $('#d-name').textContent = d.fileName;
  $('#d-sub').textContent = `${STATUS[d.status]} · ${bytes(d.downloaded)} of ${bytes(d.size)}`;
  const cs = d.checksum || {};
  const match = cs.match === true ? '<span class="ok">✔ matches expected</span>' : cs.match === false ? '<span class="bad">✘ mismatch</span>' : '';
  $('#d-info').innerHTML = [
    ['URL', esc(d.url)],
    ['Saved to', esc(d.dir)],
    ['Category', esc(d.category)],
    ['Resumable', d.size == null && !d.resumable ? 'unknown' : d.resumable ? 'Yes' : 'No — restarts from zero'],
    d.kind === 'ytdlp'
      ? ['Source', `Video site · ${esc(d.ytdlp?.label ?? '')}${d.ytdlp?.phase === 'merging' ? ' · merging audio and video' : ''}`]
      : d.kind === 'hls'
      ? ['Stream', `HLS ${esc(d.hls?.label ?? '')} · ${d.hls?.done ?? 0} / ${d.hls?.total || '?'} segments`]
      : ['Segments', d.segments.length],
    ...(d.pageUrl ? [['From page', esc(d.pageUrl)]] : []),
    ['SHA-256', cs.sha256 ? `<code>${cs.sha256}</code> ${match}` : '—'],
    ['MD5', cs.md5 ? `<code>${cs.md5}</code>` : '—'],
    ['Expected', esc(cs.expected ?? '—')],
  ]
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
    .join('');
  $('#d-conns tbody').innerHTML =
    d.activeConnections
      .map((c, i) => d.kind === 'hls'
        ? `<tr><td>${i + 1}</td><td>segment ${c.start < 0 ? 'init' : c.start + 1}</td><td>—</td><td class="num">${bytes(c.speed)}/s</td></tr>`
        : `<tr><td>${i + 1}</td><td>${bytes(c.start)} – ${bytes(c.end)}</td><td>${(((c.pos - c.start) / Math.max(1, c.end - c.start)) * 100).toFixed(0)}%</td><td class="num">${bytes(c.speed)}/s</td></tr>`)
      .join('') || '<tr><td colspan="4" class="muted">No open connections</td></tr>';
  drawSegments(d);
  if (detailsFor !== d.id) {
    detailsFor = d.id;
    $('#d-limit').value = Math.round(d.speedLimit / 1024);
    $('#d-conn').value = d.connections;
    $('#d-expect').value = cs.expected ?? '';
    $('#d-url').value = d.url;
    loadLog(d.id);
  }
}

async function loadLog(id) {
  try {
    const rec = await api('GET', `/downloads/${id}`);
    $('#d-log').textContent = rec.log.join('\n');
  } catch {}
}

/** Segment map: each segment's downloaded part is filled; open connections glow. */
function drawSegments(d) {
  const cv = $('#segmap');
  const w = (cv.width = cv.clientWidth * devicePixelRatio);
  const h = (cv.height = 26 * devicePixelRatio);
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const total = d.size || 1;
  const css = getComputedStyle(document.documentElement);
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, css.getPropertyValue('--accent'));
  grad.addColorStop(1, css.getPropertyValue('--accent-2'));
  ctx.fillStyle = grad;
  if (d.status === 'completed') ctx.fillRect(0, 0, w, h);
  if (d.kind === 'hls' || d.kind === 'ytdlp') return void ctx.fillRect(0, 0, w * progress(d), h);
  for (const s of d.segments) {
    const end = s.end ?? total;
    ctx.fillRect((s.start / total) * w, 0, ((s.pos - s.start) / total) * w, h);
  }
  ctx.fillStyle = css.getPropertyValue('--text');
  for (const c of d.activeConnections) {
    ctx.fillRect((c.pos / total) * w - 1, 0, 2 * devicePixelRatio, h); // live write head
  }
}

// ---------------------------------------------------------------- render

function render() {
  if (!state.snap) return;
  renderSidebar();
  renderTable();
  renderToolbar();
  renderDetails();
  renderWelcome();
  renderUpdate();
}

// --------------------------------------------------------- update banner

let updateDismissed = ''; // the version the user dismissed this session
function renderUpdate() {
  const u = state.snap.update;
  const banner = $('#update-banner');
  const show = u && u.available && u.latest && u.latest !== updateDismissed;
  banner.classList.toggle('hidden', !show);
  if (!show) return;
  $('#update-text').textContent = `Harbor ${u.latest} is available (you have ${u.current}).`;
  $('#update-link').href = u.url || '#';
}
$('#update-dismiss').onclick = () => {
  updateDismissed = state.snap?.update?.latest || '';
  renderUpdate();
};

// ------------------------------------------------------------ first-run welcome

// An 11 KB kernel patch whose SHA-256 kernel.org publishes in sha256sums.asc.
const TEST_URL = 'https://cdn.kernel.org/pub/linux/kernel/v6.x/patch-6.6.1.xz';
const TEST_SHA = 'sha256:39654b8d91e5c36544bc987a8ab353f53cdea738179155cd6eb7c992ba7f8c04';
let welcomeShown = false;
let testId = null;

async function openWelcome() {
  const f = $('#form-welcome');
  const s = state.snap;
  f.baseDir.value = s.settings.baseDir;
  f.net.value = s.settings.connections <= 4 ? '4' : '8';
  $('#w-ext-path').textContent = `${s.appDir}\\extension`.replace(/\//g, '\\');
  const st = await api('GET', '/startup').catch(() => ({ supported: false }));
  $('#w-startup-step').hidden = !st.supported;
  f.startup.checked = !!st.on;
  $('#dlg-welcome').showModal();
  renderWelcome();
}

function renderWelcome() {
  if (!welcomeShown && !state.snap.settings.onboarded) {
    welcomeShown = true;
    openWelcome();
  }
  if (!$('#dlg-welcome').open) return;
  const seen = state.snap.extensionSeen;
  const live = seen && Date.now() - seen.at < 10 * 60_000;
  const ext = $('#w-ext');
  ext.textContent = live ? `✔ Browser extension connected (${seen.client.replace('extension/', 'v')})` : 'Waiting for the browser extension… (open any page once it is loaded)';
  ext.classList.toggle('ok', !!live);
  $('#w-ext-help').hidden = !!live;
  const t = testId && state.snap.downloads.find((d) => d.id === testId);
  if (t) {
    $('#w-test-status').innerHTML =
      t.status === 'completed' && t.checksum?.match
        ? '<span class="ok">✔ Downloaded and verified: SHA-256 matches kernel.org</span>'
        : t.status === 'error'
          ? `<span class="bad">✘ ${esc(t.error)}</span>`
          : `${STATUS[t.status]}…`;
  }
}

$('#w-test').onclick = async () => {
  try {
    const d = await api('POST', '/downloads', { url: TEST_URL, checksum: TEST_SHA, start: 'now', description: 'Harbor test download' });
    testId = d.id;
    renderWelcome();
  } catch (e) {
    $('#w-test-status').textContent = e.message;
  }
};

$('#dlg-welcome').addEventListener('close', async () => {
  const f = $('#form-welcome');
  const done = $('#dlg-welcome').returnValue === 'done';
  try {
    const patch = { onboarded: true };
    if (done) {
      patch.baseDir = f.baseDir.value.trim() || state.snap.settings.baseDir;
      patch.connections = Number(f.net.value);
      // Category folders follow the base folder when it changes.
      if (patch.baseDir !== state.snap.settings.baseDir) {
        const old = state.snap.settings.baseDir;
        patch.categories = state.snap.settings.categories.map((c) => ({ ...c, dir: c.dir.startsWith(old) ? patch.baseDir + c.dir.slice(old.length) : c.dir }));
      }
      if (!$('#w-startup-step').hidden) await api('PUT', '/startup', { on: f.startup.checked });
    }
    await api('PUT', '/settings', patch);
    if (done) toast('All set. Paste a link or use the video button in your browser.');
  } catch (e) {
    toast(e.message);
  }
});
$('#btn-welcome').onclick = () => {
  $('#dlg-settings').close('');
  openWelcome();
};

// --------------------------------------------------------------- events

$('#sidebar').addEventListener('click', (e) => {
  const a = e.target.closest('a[data-view]');
  if (!a) return;
  state.view = a.dataset.view;
  render();
});

$('#list thead').addEventListener('click', (e) => {
  const key = e.target.closest('th')?.dataset.sort;
  if (!key) return;
  state.sort = { key, asc: state.sort.key === key ? !state.sort.asc : true };
  render();
});

$('#list tbody').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (!tr) return;
  const id = tr.dataset.id;
  if (e.ctrlKey || e.metaKey) state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
  else state.selected = new Set([id]);
  state.focus = id;
  render();
});
$('#list tbody').addEventListener('dblclick', (e) => {
  const id = e.target.closest('tr[data-id]')?.dataset.id;
  const d = state.snap.downloads.find((x) => x.id === id);
  if (d && d.status !== 'completed') act(d.status === 'downloading' ? 'pause' : 'resume', [id]);
});

$('#search').addEventListener('input', (e) => {
  state.filter = e.target.value;
  render();
});

async function act(what, ids = [...state.selected]) {
  for (const id of ids) {
    try {
      if (what === 'delete') await api('DELETE', `/downloads/${id}`);
      else await api('POST', `/downloads/${id}/${what}`);
    } catch (e) {
      toast(e.message);
    }
  }
  if (what === 'delete') state.selected.clear(), (state.focus = null);
}
$('#btn-resume').onclick = () => act('resume');
$('#btn-pause').onclick = () => act('pause');
$('#btn-delete').onclick = () => {
  if (confirm(`Remove ${state.selected.size} download(s) from the list? Partial data is deleted; finished files stay on disk.`)) act('delete');
};
$('#btn-pause-all').onclick = () => api('POST', '/pause-all');
$('#btn-queue').onclick = () => api('POST', state.snap.queueRunning ? '/queue/stop' : '/queue/start');
const THEMES = { auto: ['themeAuto', 'Auto'], light: ['themeLight', 'Light'], dark: ['themeDark', 'Dark'] };
function applyTheme(t) {
  if (!THEMES[t]) t = 'auto';
  document.documentElement.dataset.theme = t;
  const b = $('#btn-theme');
  b.innerHTML = I[THEMES[t][0]];
  b.title = b.ariaLabel = `Appearance: ${THEMES[t][1]}`;
}
$('#btn-theme').onclick = () => {
  const order = ['auto', 'light', 'dark'];
  const t = order[(order.indexOf(document.documentElement.dataset.theme) + 1) % order.length];
  applyTheme(t);
  localStorage.setItem('theme', t);
  toast(`Appearance: ${THEMES[t][1]}`);
  render();
};
applyTheme(localStorage.getItem('theme') || 'auto');
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => render()); // repaint canvas colors
$('#d-close').onclick = () => {
  state.focus = null;
  render();
};
$('#d-save').onclick = async () => {
  try {
    await api('PUT', `/downloads/${state.focus}`, {
      speedLimit: Number($('#d-limit').value) * 1024,
      connections: Number($('#d-conn').value),
      checksum: $('#d-expect').value.trim(),
      url: $('#d-url').value.trim(),
    });
    toast('Saved');
  } catch (e) {
    toast(e.message);
  }
};
$('#d-redo').onclick = () => api('POST', `/downloads/${state.focus}/redownload`).catch((e) => toast(e.message));

// ------------------------------------------------------------ add dialog

function openAdd(url = '') {
  const f = $('#form-add');
  f.reset();
  f.url.value = url;
  f.connections.value = state.snap.settings.connections;
  f.category.innerHTML = '<option value="">Auto (by file type)</option>' + state.snap.settings.categories.map((c) => `<option>${esc(c.name)}</option>`).join('');
  $('#dlg-add').showModal();
}
$('#btn-add').onclick = () => openAdd();
$('#dlg-add').addEventListener('close', async () => {
  const mode = $('#dlg-add').returnValue;
  if (!mode || mode === 'cancel') return;
  const f = $('#form-add');
  try {
    const d = await api('POST', '/downloads', {
      url: f.url.value,
      fileName: f.fileName.value || undefined,
      dir: f.dir.value || undefined,
      category: f.category.value || undefined,
      connections: Number(f.connections.value),
      speedLimit: Number(f.speedLimit.value) * 1024,
      checksum: f.checksum.value.trim() || undefined,
      description: f.description.value || undefined,
      start: mode,
    });
    state.selected = new Set([d.id]);
    state.focus = d.id;
  } catch (e) {
    toast(e.message);
  }
});

// Paste a link anywhere (outside a text field) to add it.
document.addEventListener('paste', (e) => {
  if (e.target.closest('input, textarea') || document.querySelector('dialog[open]')) return;
  const text = e.clipboardData.getData('text').trim();
  if (/^https?:\/\/\S+$/i.test(text)) openAdd(text);
});
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select') || document.querySelector('dialog[open]')) return;
  if (e.key === 'n' || e.key === 'N') (e.preventDefault(), openAdd());
  if (e.key === 'Delete' && state.selected.size) $('#btn-delete').click();
  if (e.key === ' ' && state.focus) {
    e.preventDefault();
    const d = state.snap.downloads.find((x) => x.id === state.focus);
    if (d) act(d.status === 'downloading' ? 'pause' : 'resume', [d.id]);
  }
});

// -------------------------------------------------------- settings dialog

// ------------------------------------------------------------ Pro licence

const BUY_URL = '#'; // set to the merchant-of-record checkout once it exists

function renderPro(st) {
  const box = $('#pro-status');
  if (!st) return;
  const tier = st.tier === 'pro' ? `Pro${st.plan === 'pro-yearly' ? ' (yearly)' : ' (lifetime)'}` : st.tier === 'trial' ? 'Pro trial' : 'Free';
  const detail =
    st.tier === 'pro'
      ? `Licensed to ${esc(st.email)}${st.expires ? ` · renews/expires ${esc(st.expires)}` : ''}`
      : st.tier === 'trial'
        ? `${st.trialDaysLeft} day${st.trialDaysLeft === 1 ? '' : 's'} left`
        : st.trialAvailable
          ? 'Try every Pro feature free for 14 days, no card needed.'
          : 'Your trial has ended.';
  box.innerHTML = `<span class="tier ${st.pro ? 'pro' : ''}">${tier}</span>${detail}${st.error ? `<span class="err">${esc(st.error)}</span>` : ''}`;
  $('#pro-key-row').hidden = st.tier === 'pro';
  $('#pro-trial').hidden = !st.trialAvailable;
  $('#pro-buy').hidden = st.tier === 'pro';
  $('#pro-buy').href = BUY_URL;
  $('#pro-remove').hidden = st.tier !== 'pro';
  // Gated controls
  const f = $('#form-settings');
  f.connections.max = st.maxConnections;
  $('#conn-hint').textContent = st.pro ? '(up to 32 with Pro)' : '(up to 8; 32 with Pro)';
  for (const o of f.onDone.querySelectorAll('option[data-pro]')) {
    o.disabled = !st.pro;
    o.textContent = o.textContent.replace(/ \(Pro\)$/, '') + (st.pro ? '' : ' (Pro)');
  }
  $('#d-conn').max = st.maxConnections;
  $('#form-add').connections.max = st.maxConnections;
}

async function proCall(method, path, body) {
  try {
    renderPro(await api(method, path, body));
    return true;
  } catch (e) {
    toast(e.message);
    return false;
  }
}
$('#pro-activate').onclick = async () => {
  if (await proCall('PUT', '/license', { key: $('#pro-key').value })) {
    $('#pro-key').value = '';
    toast('Harbor Pro activated. Thank you!');
  }
};
$('#pro-trial').onclick = async () => {
  if (await proCall('POST', '/license/trial')) toast('Pro trial started: 14 days.');
};
$('#pro-remove').onclick = async () => {
  if (confirm('Remove the licence from this PC? You can enter the key again later.')) await proCall('DELETE', '/license');
};

$('#btn-settings').onclick = () => {
  const s = state.snap.settings;
  const f = $('#form-settings');
  f.connections.value = s.connections;
  f.maxConcurrent.value = s.maxConcurrent;
  f.globalSpeedLimit.value = Math.round(s.globalSpeedLimit / 1024);
  f.baseDir.value = s.baseDir;
  f.schedEnabled.checked = s.scheduler.enabled;
  f.startAt.value = s.scheduler.startAt;
  f.stopAt.value = s.scheduler.stopAt;
  f.onDone.value = s.scheduler.onDone;
  f.requirePairing.checked = !!s.requirePairing;
  f.updateCheck.checked = s.updateCheck !== false;
  renderUpdateStatus();
  renderPro(state.snap.license);
  renderPairing();
  $('#cat-list').innerHTML = s.categories
    .map((c, i) => `<div class="cell"><b>${esc(c.name)}</b><input data-i="${i}" data-k="exts" value="${esc(c.exts.join(' '))}" title="File extensions" aria-label="${esc(c.name)} extensions"></div>
                    <div class="cell sub"><span>Folder</span><input data-i="${i}" data-k="dir" value="${esc(c.dir)}" aria-label="${esc(c.name)} folder"></div>`)
    .join('');
  $('#dlg-settings').showModal();
};
$('#dlg-settings').addEventListener('close', async () => {
  if ($('#dlg-settings').returnValue !== 'save') return;
  const f = $('#form-settings');
  const categories = structuredClone(state.snap.settings.categories);
  for (const inp of $('#cat-list').querySelectorAll('input')) {
    const c = categories[inp.dataset.i];
    c[inp.dataset.k] = inp.dataset.k === 'exts' ? inp.value.toLowerCase().split(/[\s,]+/).filter(Boolean) : inp.value;
  }
  try {
    await api('PUT', '/settings', {
      connections: Number(f.connections.value),
      maxConcurrent: Number(f.maxConcurrent.value),
      globalSpeedLimit: Number(f.globalSpeedLimit.value) * 1024,
      baseDir: f.baseDir.value,
      categories,
      scheduler: { enabled: f.schedEnabled.checked, startAt: f.startAt.value || '02:00', stopAt: f.stopAt.value, onDone: f.onDone.value },
      requirePairing: f.requirePairing.checked,
      updateCheck: f.updateCheck.checked,
    });
    toast('Settings saved');
  } catch (e) {
    toast(e.message);
  }
});

// Browser pairing: show the 6-digit code (the engine only reveals it to this first-party UI).
async function renderPairing() {
  const box = $('#pair-text');
  try {
    const p = await api('GET', '/pairing/status');
    box.innerHTML = p.paired
      ? `<span class="ok">✓ A browser is paired.</span> Pairing code <code>${esc(p.code)}</code> · <a href="#" id="pair-reset">Unpair / new code</a>`
      : `Pairing code: <code style="font-size:16px">${esc(p.code)}</code> — enter it once in the Harbor extension popup. <a href="#" id="pair-reset">New code</a>`;
    const reset = $('#pair-reset');
    if (reset)
      reset.onclick = async (e) => {
        e.preventDefault();
        await api('POST', '/pairing/reset');
        renderPairing();
        toast('Pairing reset — paired browsers must pair again.');
      };
  } catch {
    box.textContent = 'Unavailable.';
  }
}

// Update check: show the last result, and let the user check on demand.
function renderUpdateStatus() {
  const box = $('#update-status');
  const u = state.snap?.update;
  if (!u) return (box.textContent = '');
  if (u.available) box.innerHTML = `<span class="ok">Harbor ${esc(u.latest)} available.</span>`;
  else if (u.error) box.textContent = `Couldn't check (${esc(u.error)}).`;
  else if (u.checkedAt) box.textContent = `Up to date (Harbor ${esc(u.current)}).`;
  else box.textContent = '';
}
$('#btn-check-update').onclick = async () => {
  const btn = $('#btn-check-update');
  btn.disabled = true;
  $('#update-status').textContent = 'Checking…';
  try {
    await api('POST', '/update/check');
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
    renderUpdateStatus();
  }
};

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}

connect();

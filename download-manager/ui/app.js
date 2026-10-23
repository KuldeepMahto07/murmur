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
  const link = (key, label, n) => `<a data-view="${esc(key)}" class="${state.view === key ? 'on' : ''}">${esc(label)}<span class="n">${n || ''}</span></a>`;
  let html = VIEWS.map(([k, l, f]) => link(k, l, ds.filter(f).length)).join('');
  const cats = [...state.snap.settings.categories.map((c) => c.name), 'General', 'Custom'];
  html += '<h5>Categories</h5>' + cats.map((c) => link('cat:' + c, c, ds.filter((d) => d.category === c).length)).join('');
  $('#sidebar').innerHTML = html;
}

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
      const kindTag = d.kind === 'hls' ? ' · HLS' : d.kind === 'ytdlp' ? ' · yt-dlp' : '';
      const status = d.status === 'error' ? `Error: ${d.error}` : d.status === 'downloading' ? `${STATUS[d.status]} · ${d.activeConnections.length} conn` : STATUS[d.status];
      return `<tr data-id="${d.id}" class="${state.selected.has(d.id) ? 'sel' : ''}">
        <td class="name" title="${esc(d.url)}"><span class="ext">${esc(ext)}</span>${esc(d.fileName)}</td>
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
  $('#btn-queue').textContent = state.snap.queueRunning ? '⏹ Stop queue' : '⏵ Start queue';
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
      ? ['Source', `yt-dlp · ${esc(d.ytdlp?.label ?? '')}${d.ytdlp?.phase === 'merging' ? ' · merging audio and video' : ''}`]
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
}

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
    const d = await api('POST', '/downloads', { url: TEST_URL, checksum: TEST_SHA, start: 'now', description: 'Fetchline test download' });
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
$('#btn-theme').onclick = () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  localStorage.setItem('theme', t);
  render();
};
document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';
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
  $('#cat-list').innerHTML = s.categories
    .map((c, i) => `<div class="cat"><b>${esc(c.name)}</b><input data-i="${i}" data-k="exts" value="${esc(c.exts.join(' '))}" title="Extensions"></div>
                    <div class="cat"><span class="muted">folder</span><input data-i="${i}" data-k="dir" value="${esc(c.dir)}"></div>`)
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
    });
    toast('Settings saved');
  } catch (e) {
    toast(e.message);
  }
});

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}

connect();

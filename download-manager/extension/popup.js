const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const status = await chrome.runtime.sendMessage({ type: 'status' });
  const showStatus = (s) => {
    $('#status').textContent = `● ${s.targetName} ${s.engine ? 'running' : 'not running'}`;
    $('#status').className = `status ${s.engine ? 'ok' : 'bad'}`;
  };
  const showTarget = (t) => {
    document.querySelectorAll('input[name=target]').forEach((r) => (r.checked = r.value === t));
    document.querySelectorAll('.sub').forEach((d) => (d.hidden = d.dataset.for !== t));
    $('#open').hidden = t !== 'fetchline';
  };
  showStatus(status);
  showTarget(status.target);
  $('#takeover').checked = status.takeover;
  // @ytdlp:start
  $('#ytdlp').checked = status.ytdlp;
  $('#ytdlpStatus').textContent = !status.fetchlineUp
    ? 'Needs Harbor running.'
    : status.ytdlpVersion
      ? 'Ready. These downloads always go to Harbor.'
      : "Video-site support isn't set up on this PC yet.";
  $('#ytdlp').onchange = (e) => save({ ytdlp: e.target.checked });
  // @ytdlp:end
  $('#port').value = status.port;
  $('#abdmPort').value = status.abdmPort;
  $('#abdmKey').value = status.abdmKey;

  const save = async (patch) => {
    await chrome.storage.local.set(patch);
    showStatus(await chrome.runtime.sendMessage({ type: 'status' }));
  };
  document.querySelectorAll('input[name=target]').forEach((r) => (r.onchange = () => (showTarget(r.value), save({ target: r.value }))));
  $('#takeover').onchange = (e) => save({ takeover: e.target.checked });
  $('#port').onchange = (e) => save({ port: Number(e.target.value) || 8765 });
  $('#abdmPort').onchange = (e) => save({ abdmPort: Number(e.target.value) || 15151 });
  $('#abdmKey').onchange = (e) => save({ abdmKey: e.target.value.trim() });
  $('#open').onclick = () => chrome.tabs.create({ url: `http://127.0.0.1:${$('#port').value}/` });

  // Browser pairing: shown when Harbor is reachable and the destination is Harbor.
  const pairRow = $('#pairRow');
  const pairBox = $('#pairBox');
  function renderPair(s) {
    pairRow.hidden = !(s.target === 'fetchline' && s.fetchlineUp);
    if (pairRow.hidden) return;
    if (s.paired) {
      pairBox.innerHTML = '<span class="ok">✓ Paired with Harbor.</span> <a href="#" id="unpair">Unpair</a>';
      $('#unpair').onclick = async (e) => {
        e.preventDefault();
        await chrome.runtime.sendMessage({ type: 'unpair' });
        renderPair(await chrome.runtime.sendMessage({ type: 'status' }));
      };
    } else {
      pairBox.innerHTML =
        'Enter the code from Harbor → Settings → Browser pairing:' +
        '<div style="display:flex;gap:6px;margin-top:6px"><input id="pairCode" inputmode="numeric" maxlength="6" placeholder="6-digit code" style="flex:1" /><button id="pairBtn" type="button">Pair</button></div>' +
        '<div id="pairMsg" style="margin-top:4px"></div>';
      $('#pairBtn').onclick = async () => {
        const out = await chrome.runtime.sendMessage({ type: 'pair', code: $('#pairCode').value });
        if (out.ok) renderPair(await chrome.runtime.sendMessage({ type: 'status' }));
        else $('#pairMsg').innerHTML = `<span class="bad">${esc(out.error)}</span>`;
      };
    }
  }
  renderPair(status);

  if (!tab?.id) return;
  const res = await chrome.runtime.sendMessage({ type: 'list', tabId: tab.id });
  const list = $('#list');
  if (res.error) return (list.textContent = res.error);
  if (!res.entries.length) return (list.textContent = 'Nothing detected yet. Play a video on the page.');
  list.textContent = '';
  list.classList.remove('muted');
  for (const r of res.entries) {
    const b = document.createElement('button');
    b.className = `row ${r.kind === 'blocked' ? 'blocked' : ''}`;
    b.innerHTML = `<div>${esc(r.label)}</div><div class="s">${esc(r.sub)}</div>`;
    if (r.kind !== 'blocked' && res.engine)
      b.onclick = async () => {
        const out = await chrome.runtime.sendMessage({ type: 'download', tabId: tab.id, url: r.url, kind: r.kind, variant: r.variant, title: tab.title, pageUrl: tab.url });
        if (out.error) alert(out.error);
        else b.classList.add('sent');
      };
    list.appendChild(b);
  }
})();

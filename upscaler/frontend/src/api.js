async function j(res) {
  if (!res.ok) {
    let msg = res.statusText
    try { msg = (await res.json()).detail || msg } catch { /* not json */ }
    throw new Error(msg)
  }
  return res.json()
}

export const api = {
  options: () => fetch('/api/options').then(j),
  system: () => fetch('/api/system').then(j),
  jobs: () => fetch('/api/jobs').then(j),
  create: (file, settings) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('settings', JSON.stringify(settings))
    return fetch('/api/jobs', { method: 'POST', body: fd }).then(j)
  },
  rerun: (id, settings) =>
    fetch(`/api/jobs/${id}/rerun`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
    }).then(j),
  cancel: (id) => fetch(`/api/jobs/${id}/cancel`, { method: 'POST' }).then(j),
  remove: (id) => fetch(`/api/jobs/${id}`, { method: 'DELETE' }).then(j),
}

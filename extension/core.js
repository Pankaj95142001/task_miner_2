export function safeUrl(value) {
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? `${url.origin}${url.pathname}` : ''; }
  catch { return ''; }
}

export function eligible(tab, config = {}) {
  if (!tab || tab.incognito || !safeUrl(tab.url)) return false;
  try {
    const origin = new URL(tab.url).origin;
    return ![config.api, config.dashboard].filter(Boolean).some(url => new URL(url).origin === origin);
  } catch { return false; }
}

export function beforeSnapshot(snapshot, event, now = Date.now()) {
  if (!snapshot?.data_url) return { note: 'No earlier screenshot is available for this tab.' };
  const captured = Date.parse(snapshot.captured_at);
  const occurred = Date.parse(event.occurred_at);
  if (!Number.isFinite(captured) || captured > occurred || now - captured > 45000) return { note: 'An earlier screenshot was not available within the last 45 seconds.' };
  if (!['navigate', 'tab_switch'].includes(event.action) && safeUrl(snapshot.url) !== safeUrl(event.url)) return { note: 'The page changed before a matching screenshot was available.' };
  return { ...snapshot, note: 'Most recent pre-action view; verify that it matches this step.' };
}

export function validateConfig(config) {
  const api = new URL(config.api);
  const dashboard = new URL(config.dashboard);
  for (const url of [api, dashboard]) {
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) || url.username || url.password) throw new Error('Use an http://localhost or http://127.0.0.1 address for this local MVP.');
  }
  if (!config.token || config.token.trim().length < 16) throw new Error('Enter your local session token.');
  return { api: api.origin, dashboard: dashboard.origin, token: config.token.trim() };
}

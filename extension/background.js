import { beforeSnapshot, eligible, safeUrl, validateConfig } from './core.js';

const DEFAULT_CONFIG = { api: 'http://127.0.0.1:8000', dashboard: 'http://127.0.0.1:8000', token: '' };
let mutations = Promise.resolve();
let captures = Promise.resolve();
let pumping = false;
let processingCaptures = false;
const snapshotPending = new Set();
let nextCapture = 0;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const atomic = fn => { const result = mutations.then(fn); mutations = result.catch(() => {}); return result; };
const storage = keys => chrome.storage.local.get(keys);
const emptyShot = note => ({ note });

async function config() { return (await storage('config')).config || DEFAULT_CONFIG; }

async function api(path, body, method = 'POST') {
  const cfg = await config();
  const response = await fetch(`${cfg.api}/api${path}`, {
    method, headers: { Authorization: `Bearer ${cfg.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(typeof result.detail === 'string' ? result.detail : `Backend returned ${response.status}.`);
  }
  return response.json();
}

async function publicState(tab) {
  const { session, queue = [], lastError = '', lastWorkflow } = await storage(['session', 'queue', 'lastError', 'lastWorkflow']);
  const cfg = await config();
  const active = session?.phase === 'recording' && (!tab || eligible(tab, cfg));
  return { active, phase: session?.phase || 'idle', title: session?.title || '', count: session ? session.nextSequence - 1 : 0,
    pending: queue.length, lastError, workflowId: session?.id || lastWorkflow || '', api: cfg.api, dashboard: cfg.dashboard, configured: Boolean(cfg.token) };
}

async function badge() {
  const state = await publicState();
  const text = state.phase === 'recording' ? 'REC' : state.phase === 'paused' ? 'Ⅱ' : state.pending || state.phase === 'stopping' ? 'SYNC' : '';
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: state.phase === 'recording' ? '#b85645' : '#194f43' });
}

async function broadcast() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(async tab => {
    try { await chrome.tabs.sendMessage(tab.id, { type: 'STATE', state: await publicState(tab) }); } catch { /* Restricted or unopened pages. */ }
  }));
  await badge();
}

function capture(tabId, reason) {
  const result = captures.then(async () => {
    let prepared = false;
    let tab;
    try {
      await wait(Math.max(0, nextCapture - Date.now()));
      nextCapture = Date.now() + 600; // Chrome permits at most two screenshots per second.
      tab = await chrome.tabs.get(tabId);
      const cfg = await config();
      const browserWindow = await chrome.windows.get(tab.windowId);
      if (!eligible(tab, cfg) || !tab.active || !browserWindow.focused) return emptyShot('This tab was not visible when the screenshot was due.');
      const ready = await chrome.tabs.sendMessage(tabId, { type: 'PREPARE_SCREENSHOT' }, { frameId: 0 });
      if (!ready?.ready) return emptyShot('The page could not prepare a screenshot.');
      prepared = true;
      const check = await chrome.tabs.get(tabId);
      if (!check.active || check.url !== tab.url) return emptyShot('The tab navigated before capture.');
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 75 });
      const finished = new Date().toISOString();
      const after = await chrome.tabs.get(tabId);
      const [visible] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
      if (visible?.id !== tabId || after.url !== tab.url) return emptyShot('The tab switched or navigated during capture.');
      return { data_url: dataUrl, captured_at: finished, url: safeUrl(tab.url), note: reason };
    } catch {
      return emptyShot('Screenshot unavailable: the page closed, navigated, or disallowed capture.');
    } finally {
      if (prepared) chrome.tabs.sendMessage(tabId, { type: 'FINISH_SCREENSHOT' }, { frameId: 0 }).catch(() => {});
    }
  });
  captures = result.catch(() => {});
  return result;
}

async function refreshSnapshot(tabId) {
  if (snapshotPending.has(tabId)) return;
  snapshotPending.add(tabId);
  try {
  const { session, snapshots = {} } = await storage(['session', 'snapshots']);
  if (session?.phase !== 'recording') return;
  if (Date.now() - Date.parse(snapshots[tabId]?.captured_at || 0) < 1400) return;
  const shot = await capture(tabId, 'Recent view of this tab.');
  if (shot.data_url) await atomic(async () => {
    const current = await storage(['session', 'snapshots']);
    if (current.session?.id !== session.id || current.session.phase !== 'recording') return;
    const snapshots = { ...current.snapshots, [tabId]: shot };
    // Bound the cache; queued steps keep their own images.
    const keys = Object.keys(snapshots).sort((a, b) => Date.parse(snapshots[a].captured_at) - Date.parse(snapshots[b].captured_at));
    for (const key of keys.slice(0, Math.max(0, keys.length - 12))) delete snapshots[key];
    await chrome.storage.local.set({ snapshots });
  });
  } finally { snapshotPending.delete(tabId); }
}

async function enqueue(event, tab) {
  const cfg = await config();
  if (!eligible(tab, cfg)) return;
  await atomic(async () => {
    const { session, queue = [], snapshots = {}, inputs = {} } = await storage(['session', 'queue', 'snapshots', 'inputs']);
    if (session?.phase !== 'recording') return;
    if (!['click', 'input', 'select', 'navigate', 'tab_switch', 'submit'].includes(event.action)) return;
    if (queue.length >= 300) {
      session.phase = 'paused';
      await chrome.storage.local.set({ session, lastError: 'The local queue reached 300 steps. Recording paused; sync before continuing.' });
      return;
    }
    const text = (value, limit) => String(value || '').slice(0, limit);
    const occurred = Date.parse(event.occurred_at);
    if (!Number.isFinite(occurred)) return;
    const before = beforeSnapshot(inputs[event.inputKey] || snapshots[tab.id], event);
    if (event.inputKey) delete inputs[event.inputKey];
    const step = { id: crypto.randomUUID(), sequence: session.nextSequence++, action: event.action,
      occurred_at: new Date(occurred).toISOString(), tab_id: tab.id, url: safeUrl(event.url || tab.url),
      page_title: text(event.page_title || tab.title, 500), selector: text(event.selector, 1000),
      browser_target: event.sensitive ? null : event.browser_target || null,
      label: event.sensitive ? 'the private field' : text(event.label, 300),
      value: event.sensitive ? '' : text(event.value, 2000), sensitive: Boolean(event.sensitive), before,
      coordinates: event.action === 'click' ? event.coordinates || null : null,
      after: emptyShot('Waiting for the post-action screenshot.') };
    queue.push({ workflowId: session.id, tabId: tab.id, step, stage: 'capture', due: Date.now() + 700 });
    await chrome.storage.local.set({ session, queue, inputs });
  });
  await badge();
  void processCaptures();
  void pump();
}

async function processCaptures() {
  if (processingCaptures) return;
  processingCaptures = true;
  try {
    while (true) {
      const { queue = [] } = await storage('queue');
      const job = queue.find(item => item.stage === 'capture');
      if (!job) break;
      await wait(Math.max(0, job.due - Date.now()));
      const shot = Date.now() - job.due > 6000 ? emptyShot('The capture window was missed; verify this step manually.') : await capture(job.tabId, 'Post-action view. Rapid actions may overlap; verify the visible result.');
      await atomic(async () => {
        const state = await storage(['queue', 'snapshots']);
        const current = (state.queue || []).find(item => item.step.id === job.step.id);
        if (!current) return;
        current.step.after = shot; current.stage = 'upload';
        const snapshots = state.snapshots || {};
        if (shot.data_url) snapshots[job.tabId] = shot;
        await chrome.storage.local.set({ queue: state.queue, snapshots });
      });
      void pump();
    }
  } finally { processingCaptures = false; }
}

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (true) {
      let { queue = [], session } = await storage(['queue', 'session']);
      if (!queue.length) {
        if (session?.phase === 'stopping') {
          await api(`/workflows/${session.id}/stop`, {});
          await atomic(async () => {
            const latest = await storage(['queue', 'session']);
            if (!latest.queue?.length && latest.session?.id === session.id) await chrome.storage.local.set({ session: null, snapshots: {}, inputs: {}, lastError: '', lastWorkflow: session.id });
          });
          await broadcast();
        }
        break;
      }
      const job = queue[0];
      if (job.stage === 'capture') break;
      queue = (await storage('queue')).queue || [];
      const ready = queue.find(item => item.step.id === job.step.id);
      if (!ready) continue;
      await api(`/workflows/${ready.workflowId}/steps`, ready.step);
      await atomic(async () => {
        const latest = (await storage('queue')).queue || [];
        await chrome.storage.local.set({ queue: latest.filter(item => item.step.id !== ready.step.id), lastError: '' });
      });
      await badge();
    }
  } catch (error) {
    await chrome.storage.local.set({ lastError: `Sync pending: ${error.message} Keep the backend running; the saved queue will retry.` });
    await badge();
  } finally { pumping = false; }
}

async function flushInputs() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(tab => chrome.tabs.sendMessage(tab.id, { type: 'FLUSH_INPUTS' }, { frameId: 0 }).catch(() => {})));
  await mutations;
}

async function handle(message, sender) {
  if (sender.tab && !sender.url?.startsWith(chrome.runtime.getURL(''))) {
    if (sender.frameId !== 0) return {};
    if (message.type === 'GET_STATE') return publicState(sender.tab);
    if (message.type === 'EVENT') { await enqueue(message.event || {}, sender.tab); return { ok: true }; }
    if (message.type === 'SNAPSHOT_HINT') { void refreshSnapshot(sender.tab.id); return { ok: true }; }
    if (message.type === 'BEGIN_INPUT') {
      await atomic(async () => {
        const { session, snapshots = {}, inputs = {} } = await storage(['session', 'snapshots', 'inputs']);
        if (session?.phase !== 'recording' || !eligible(sender.tab, await config())) return;
        const key = String(message.key || '').slice(0, 100);
        if (key) {
          const entries = Object.entries(inputs).slice(-20);
          await chrome.storage.local.set({ inputs: { ...Object.fromEntries(entries), [key]: snapshots[sender.tab.id] || {} } });
        }
      });
      return { ok: true };
    }
    return {};
  }
  if (!sender.url?.startsWith(chrome.runtime.getURL(''))) throw new Error('Unsupported sender.');
  switch (message.type) {
    case 'GET_STATE': return publicState();
    case 'GET_CONFIG': return config();
    case 'SAVE_CONFIG': {
      if ((await storage('session')).session) throw new Error('Stop and sync before changing the connection.');
      const cfg = validateConfig(message.config);
      await chrome.storage.local.set({ config: cfg });
      await api('/settings', null, 'GET');
      return { ok: true };
    }
    case 'START': {
      const { session, queue = [] } = await storage(['session', 'queue']);
      if (session || queue.length) throw new Error('Finish the current recording first.');
      validateConfig(await config());
      const title = String(message.title || '').trim().slice(0, 200);
      if (!title) throw new Error('Name your workflow first.');
      const workflow = await api('/workflows', { title });
      await atomic(() => chrome.storage.local.set({ session: { id: workflow.id, title, phase: 'recording', nextSequence: 1 }, queue: [], snapshots: {}, inputs: {}, lastError: '' }));
      await broadcast();
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab && eligible(tab, await config())) { await enqueue({ action: 'navigate', occurred_at: new Date().toISOString(), url: tab.url, page_title: tab.title }, tab); }
      return publicState();
    }
    case 'PAUSE':
    case 'RESUME': {
      if (message.type === 'PAUSE') await flushInputs();
      await atomic(async () => {
        const { session } = await storage('session');
        if (!session || session.phase === 'stopping') throw new Error('There is no active recording.');
        session.phase = message.type === 'PAUSE' ? 'paused' : 'recording';
        await chrome.storage.local.set({ session, snapshots: {}, inputs: {} });
      });
      await broadcast(); return publicState();
    }
    case 'STOP': {
      await flushInputs();
      await atomic(async () => {
        const { session } = await storage('session');
        if (!session) return;
        session.phase = 'stopping';
        await chrome.storage.local.set({ session });
      });
      await broadcast(); void pump(); return publicState();
    }
    case 'RETRY': void pump(); return publicState();
    case 'DASHBOARD': await chrome.tabs.create({ url: (await config()).dashboard }); return { ok: true };
    default: throw new Error('Unknown recorder command.');
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  handle(message, sender).then(data => respond({ ok: true, data })).catch(error => respond({ ok: false, error: error.message }));
  return true;
});
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'sync') { void processCaptures(); void pump(); } });
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const { session } = await storage('session');
  if (!tab || session?.phase !== 'recording' || !eligible(tab, await config())) return;
  await enqueue({ action: 'tab_switch', occurred_at: new Date().toISOString(), url: tab.url, page_title: tab.title }, tab);
});
chrome.tabs.onRemoved.addListener(tabId => atomic(async () => {
  const { snapshots = {} } = await storage('snapshots');
  delete snapshots[tabId]; await chrome.storage.local.set({ snapshots });
}));
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  await chrome.alarms.create('sync', { periodInMinutes: 0.5 });
  // Already-open pages do not automatically receive newly installed content scripts.
  for (const tab of await chrome.tabs.query({})) {
    if (eligible(tab, await config())) chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['targets.js', 'content.js'] }).catch(() => {});
  }
  await badge();
});
chrome.runtime.onStartup.addListener(async () => {
  await chrome.alarms.create('sync', { periodInMinutes: 0.5 });
  await atomic(async () => {
    const { session } = await storage('session');
    if (session?.phase === 'recording') { session.phase = 'paused'; await chrome.storage.local.set({ session, snapshots: {}, inputs: {} }); }
  });
  await badge(); void pump();
});
void chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
void chrome.alarms.create('sync', { periodInMinutes: 0.5 });
void processCaptures();
void pump();

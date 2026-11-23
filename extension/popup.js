const $ = id => document.getElementById(id);
let state = {};
let busy = false;

async function send(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) throw new Error(response?.error || 'The recorder did not respond.');
  return response.data;
}
async function refresh() {
  state = await send('GET_STATE');
  const running = state.phase !== 'idle';
  $('start-form').hidden = running;
  $('recording').hidden = !running;
  $('status').textContent = { idle: 'Ready when you are', recording: '● Recording across tabs', paused: 'Recording paused', stopping: 'Finishing your recording…' }[state.phase];
  $('status').classList.toggle('live', state.phase === 'recording');
  $('headline').textContent = running ? state.title : 'Good work deserves a great guide.';
  $('intro').textContent = running ? 'Keep working across your browser tabs. Pause before opening anything you do not want recorded.' : 'Record your browser task across tabs. Review every step, then share the know-how.';
  $('count').textContent = state.count;
  $('pending').textContent = state.pending;
  $('pause').textContent = state.phase === 'paused' ? 'Resume' : 'Pause';
  $('pause').disabled = busy || state.phase === 'stopping';
  $('stop').disabled = busy || state.phase === 'stopping';
  $('retry').hidden = !state.lastError;
  if (state.lastError) $('message').textContent = state.lastError;
  $('settings-toggle').disabled = running;
  if (!state.configured) $('settings').hidden = false;
}
async function perform(fn) {
  if (busy) return;
  busy = true; $('message').textContent = '';
  document.querySelectorAll('button').forEach(button => { button.disabled = true; });
  try { await fn(); } catch (error) { $('message').textContent = error.message; }
  finally { busy = false; document.querySelectorAll('button').forEach(button => { button.disabled = false; }); await refresh(); }
}
$('start-form').addEventListener('submit', e => { e.preventDefault(); perform(() => send('START', { title: $('title').value })); });
$('pause').addEventListener('click', () => perform(() => send(state.phase === 'paused' ? 'RESUME' : 'PAUSE')));
$('stop').addEventListener('click', () => perform(() => send('STOP')));
$('retry').addEventListener('click', () => perform(() => send('RETRY')));
$('dashboard').addEventListener('click', () => perform(() => send('DASHBOARD')));
$('settings-toggle').addEventListener('click', () => { $('settings').hidden = !$('settings').hidden; });
$('settings').addEventListener('submit', e => {
  e.preventDefault();
  perform(async () => {
    await send('SAVE_CONFIG', { config: { api: $('api').value, dashboard: $('dashboard-url').value, token: $('token').value } });
    $('settings').hidden = true; $('message').textContent = 'Connected to your local workspace.';
  });
});
const cfg = await send('GET_CONFIG');
$('api').value = cfg.api; $('dashboard-url').value = cfg.dashboard; $('token').value = cfg.token;
await refresh();
setInterval(() => { if (!busy) refresh().catch(() => {}); }, 1200);

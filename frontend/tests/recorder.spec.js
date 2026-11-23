import { test, expect, chromium } from '@playwright/test';
import { createServer } from 'node:http';
import path from 'node:path';

test('extension records real actions across tabs, screenshots and offline retry', async ({ request }, testInfo) => {
  test.setTimeout(100000);
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>Recorder test task</title><style>body{font:20px system-ui;padding:60px;background:#f4f8ef}button,input{font:inherit;padding:12px;margin:10px}</style><h1>Team workspace</h1><label>Team name<input id="name"></label><label>Password<input id="password" type="password"></label><button id="save" onclick="document.querySelector(\'h1\').textContent=\'Team saved\'">Save team</button><a href="/next">Next page</a>');
  });
  await new Promise(resolve => server.listen(8766, '127.0.0.1', resolve));
  const extensionPath = path.resolve('../extension');
  const context = await chromium.launchPersistentContext(testInfo.outputPath('browser-profile'), {
    channel: 'chromium', headless: true, viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).hostname;
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    async function command(type, extra = {}) {
      const result = await popup.evaluate(message => chrome.runtime.sendMessage(message), { type, ...extra });
      expect(result.ok, result.error).toBeTruthy();
      return result.data;
    }
    await command('SAVE_CONFIG', { config: { api: 'http://127.0.0.1:8765', dashboard: 'http://127.0.0.1:8765', token: 'browser-test-session-token' } });
    const first = await context.newPage();
    await first.goto('http://127.0.0.1:8766/first');
    await first.bringToFront();
    const state = await command('START', { title: `Extension E2E ${Date.now()}` });
    const workflowPath = `/api/workflows/${state.workflowId}`;
    const headers = { Authorization: 'Bearer browser-test-session-token' };
    await expect.poll(async () => (await request.get(workflowPath, { headers })).json().then(w => w.steps.length)).toBeGreaterThan(0);
    await first.getByLabel('Team name').fill('Operations');
    await first.getByRole('button', { name: 'Save team' }).hover();
    await first.waitForTimeout(1300);
    const buttonBox = await first.getByRole('button', { name: 'Save team' }).boundingBox();
    const clickPoint = { x: Math.floor(buttonBox.x + buttonBox.width / 2), y: Math.floor(buttonBox.y + buttonBox.height / 2) };
    await first.mouse.click(clickPoint.x, clickPoint.y);
    await expect(first.getByRole('heading')).toHaveText('Team saved');
    await first.waitForTimeout(1500);
    await first.getByLabel('Password').fill('never-persist-this');
    await first.getByRole('button', { name: 'Save team' }).click();
    await first.waitForTimeout(1700);
    const second = await context.newPage();
    await second.goto('http://127.0.0.1:8766/second');
    await second.bringToFront();
    await second.getByRole('button', { name: 'Save team' }).hover();
    await second.waitForTimeout(1300);
    await second.getByRole('button', { name: 'Save team' }).click();
    await second.waitForTimeout(1500);
    // Make authenticated uploads fail without changing the recording's destination.
    await worker.evaluate(async () => {
      const { config } = await chrome.storage.local.get('config');
      await chrome.storage.local.set({ config: { ...config, token: 'temporarily-invalid-token' } });
    });
    await second.getByLabel('Team name').fill('Offline edit');
    await second.getByRole('button', { name: 'Save team' }).click();
    await second.waitForTimeout(1500);
    await second.getByRole('button', { name: 'Save team' }).click();
    await second.waitForTimeout(1500);
    await expect.poll(async () => worker.evaluate(async () => (await chrome.storage.local.get('queue')).queue.filter(job => job.stage === 'upload').length)).toBeGreaterThanOrEqual(2);
    await worker.evaluate(async () => {
      const { config } = await chrome.storage.local.get('config');
      await chrome.storage.local.set({ config: { ...config, token: 'browser-test-session-token' } });
    });
    await command('RETRY');
    await command('STOP');
    await expect.poll(async () => (await command('GET_STATE')).phase, { timeout: 20000 }).toBe('idle');
    const final = await (await request.get(workflowPath, { headers })).json();
    expect(final.status).toBe('draft');
    expect(new Set(final.steps.map(step => step.tab_id)).size).toBeGreaterThanOrEqual(2);
    expect(final.steps.some(step => step.action === 'input' && step.value === 'Operations')).toBeTruthy();
    expect(final.steps.some(step => step.action === 'click' && step.label === 'Save team')).toBeTruthy();
    const capturedClick = final.steps.find(step => step.action === 'click' && step.label === 'Save team');
    expect(capturedClick.coordinates).toMatchObject({ ...clickPoint, page_x: clickPoint.x, page_y: clickPoint.y,
      scroll_x: 0, scroll_y: 0, viewport_width: 1280, viewport_height: 900, device_pixel_ratio: 2 });
    expect(final.steps.some(step => step.before.filename && step.after.filename)).toBeTruthy();
    expect(final.steps.some(step => step.sensitive)).toBeTruthy();
    expect(JSON.stringify(final)).not.toContain('never-persist-this');
    const ids = final.steps.map(step => step.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(final.steps.map(step => step.sequence)).toEqual([...final.steps.map(step => step.sequence)].sort((a, b) => a - b));
  } finally {
    await context.close();
    await new Promise(resolve => server.close(resolve));
  }
});

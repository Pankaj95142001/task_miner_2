import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import fs from 'node:fs';
import { ChromiumRecorder } from '../recorder/engine.mjs';

const headers = { Authorization: 'Bearer browser-test-session-token' };
const api = 'http://127.0.0.1:8765';
const browserChannel = process.env.SOP_TEST_BROWSER_CHANNEL || 'chromium';
const browserName = browserChannel === 'msedge' ? 'Microsoft Edge' : 'Chromium';
let site;

test.beforeAll(async () => {
  site = createServer((req, res) => {
    if (req.url === '/report.pdf') {
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="Task report.pdf"' });
      res.write('%PDF-');
      setTimeout(() => res.end('test download fixture'), 1200);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><title>Extension-free recorder task</title>
      <style>body{font:20px system-ui;padding:60px;background:#f4f8ef}button,input{font:inherit;padding:12px;margin:10px}</style>
      <h1>Team workspace</h1><label>Team name<input id="name"></label><label>Password<input id="password" type="password"></label>
      <button data-testid="save-team" onclick="document.querySelector('h1').textContent='Team saved'">Save team</button>
      <button onclick="history.pushState({}, '', '/settings');document.querySelector('h1').textContent='Settings'">Settings</button>
      <a href="/next">Next page</a><a href="/another" target="_blank">Another tab</a><a href="/report.pdf">Download report</a>`);
  });
  await new Promise(resolve => site.listen(8767, '127.0.0.1', resolve));
});
test.afterAll(async () => { site.closeAllConnections(); await new Promise(resolve => site.close(resolve)); });

test('dedicated Chromium captures tabs, fields and screenshots; paused actions stay excluded', async ({ request }, testInfo) => {
  test.setTimeout(80000);
  const recorder = new ChromiumRecorder({ api, browser_channel: browserChannel, token: 'browser-test-session-token',
    directory: testInfo.outputPath('recorder'), downloadDirectory: testInfo.outputPath('Downloads'),
    title: `Chromium task ${Date.now()}`, recording_context: 'Create a team and download its report.', headless: true });
  try {
    await recorder.start();
    const first = recorder.context.pages()[0];
    expect(first.url()).toBe('about:blank');
    if (browserChannel === 'msedge') expect(await first.evaluate(() => navigator.userAgent)).toContain('Edg/');
    expect(recorder.report().count).toBe(0);
    expect(recorder.report().error).toBe('');
    await first.goto('http://127.0.0.1:8767/start');
    await expect.poll(() => recorder.jobs.size).toBe(0);
    await first.getByRole('button', { name: 'Save team' }).hover();
    await expect.poll(() => Boolean(recorder.pageState(first).snapshot?.data_url)).toBeTruthy();
    await first.getByLabel('Team name').fill('Operations');
    await first.getByRole('button', { name: 'Save team' }).click();
    await expect.poll(() => recorder.jobs.size).toBe(0);
    await first.getByLabel('Password').fill('never-store-this-secret');
    await first.getByRole('button', { name: 'Save team' }).click();
    await expect.poll(() => recorder.jobs.size).toBe(0);
    const count = recorder.manifest.nextSequence;
    await recorder.pause();
    await first.getByLabel('Team name').fill('Paused text must not persist');
    await first.getByRole('button', { name: 'Save team' }).click();
    await first.waitForTimeout(1000);
    expect(recorder.manifest.nextSequence).toBe(count);
    await recorder.resume();
    await first.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect.poll(() => first.url()).toContain('/settings');
    await expect.poll(() => recorder.manifest.nextSequence).toBeGreaterThan(count + 1);
    const popupPromise = recorder.context.waitForEvent('page');
    await first.getByRole('link', { name: 'Another tab' }).click();
    const second = await popupPromise;
    await second.waitForLoadState('domcontentloaded');
    await second.bringToFront();
    const downloadPromise = second.waitForEvent('download');
    await second.getByRole('link', { name: 'Download report' }).click();
    await downloadPromise;
    await second.getByLabel('Team name').fill('Immediate final edit');
    // Stop flushes the unexpired input debounce timer.
    const finished = await recorder.stop();
    expect(finished.phase).toBe('done');
    expect(finished.download_error).toBe('');
    expect(fs.readFileSync(testInfo.outputPath('Downloads', 'Task report.pdf'), 'utf8')).toBe('%PDF-test download fixture');
    const workflow = await (await request.get(`/api/workflows/${finished.workflow_id}`, { headers })).json();
    expect(workflow.status).toBe('draft');
    expect(workflow.recording_context).toBe('Create a team and download its report.');
    expect(workflow.steps.some(step => step.action === 'click' && step.browser_target?.candidates.length)).toBeTruthy();
    expect(new Set(workflow.steps.map(step => step.tab_id)).size).toBeGreaterThanOrEqual(2);
    expect(workflow.steps.some(step => step.action === 'input' && step.value === 'Operations')).toBeTruthy();
    expect(workflow.steps.some(step => step.action === 'input' && step.value === 'Immediate final edit')).toBeTruthy();
    expect(workflow.steps.some(step => step.action === 'navigate' && step.url.endsWith('/settings'))).toBeTruthy();
    expect(workflow.steps.some(step => step.action === 'click' && step.before.filename && step.after.filename)).toBeTruthy();
    expect(workflow.steps.some(step => step.sensitive && step.value === '')).toBeTruthy();
    expect(JSON.stringify(workflow)).not.toContain('never-store-this-secret');
    expect(JSON.stringify(workflow)).not.toContain('Paused text must not persist');
    expect(fs.existsSync(recorder.manifestPath)).toBeFalsy();
  } finally { await recorder.stop(); }
});

test('pointer coordinates survive scrolling and viewport resizing while keyboard clicks have no location', async ({ request }, testInfo) => {
  const recorder = new ChromiumRecorder({ api, browser_channel: browserChannel, token: 'browser-test-session-token', directory: testInfo.outputPath('coordinates'),
    title: `Coordinates ${Date.now()}`, url: 'http://127.0.0.1:8767/start', headless: true });
  try {
    await recorder.start();
    const page = recorder.context.pages()[0];
    await expect.poll(() => recorder.report().count).toBeGreaterThan(0);
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.evaluate(() => {
      document.body.style.minHeight = '2400px';
      const target = document.createElement('button');
      target.id = 'coordinate-target'; target.textContent = 'Coordinate target';
      target.style.cssText = 'position:absolute;left:300px;top:1500px';
      document.body.appendChild(target);
      window.scrollTo(0, 1200);
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1200);
    const button = page.getByRole('button', { name: 'Coordinate target', exact: true });
    const box = await button.boundingBox();
    const point = { x: Math.floor(box.x + 12), y: Math.floor(box.y + 12) };
    await page.mouse.click(point.x, point.y);
    // Zero is a legitimate coordinate; it must not be treated as missing.
    await page.mouse.click(0, 0);
    await button.focus();
    await page.keyboard.press('Enter');
    const finished = await recorder.stop();
    expect(finished.phase).toBe('done');
    const workflow = await (await request.get(`/api/workflows/${finished.workflow_id}`, { headers })).json();
    const targetClicks = workflow.steps.filter(step => step.action === 'click' && step.label === 'Coordinate target');
    expect(targetClicks).toHaveLength(2);
    expect(targetClicks[0].coordinates).toEqual({ ...point, page_x: point.x, page_y: point.y + 1200,
      scroll_x: 0, scroll_y: 1200, viewport_width: 1000, viewport_height: 700, device_pixel_ratio: 1 });
    expect(targetClicks[1].coordinates).toBeNull();
    expect(workflow.steps.some(step => step.action === 'click' && step.coordinates?.x === 0 && step.coordinates?.y === 0)).toBeTruthy();
    expect(workflow.steps.filter(step => step.action !== 'click').every(step => step.coordinates === null)).toBeTruthy();
  } finally { await recorder.stop(); }
});

test('interrupted uploads survive closing Chromium and recover without duplicate steps', async ({ request }, testInfo) => {
  const config = { api, browser_channel: browserChannel, token: 'browser-test-session-token', directory: testInfo.outputPath('recovery'),
    title: `Recovered task ${Date.now()}`, url: 'http://127.0.0.1:8767/start', headless: true };
  const recorder = new ChromiumRecorder(config);
  try {
    await recorder.start();
    const page = recorder.context.pages()[0];
    await expect.poll(() => recorder.jobs.size).toBe(0);
    config.token = 'temporarily-invalid-token';
    await page.getByLabel('Team name').fill('Saved while offline');
    await page.getByRole('button', { name: 'Save team' }).click();
    await expect.poll(() => [...recorder.jobs.values()].filter(job => job.ready).length).toBeGreaterThanOrEqual(2);
    await recorder.context.close();
    await expect.poll(() => recorder.phase).toBe('error');
    expect(fs.existsSync(recorder.manifestPath)).toBeTruthy();
    const recovery = new ChromiumRecorder({ ...config, token: 'browser-test-session-token' });
    const finished = await recovery.recover();
    expect(finished.phase).toBe('done');
    const workflow = await (await request.get(`/api/workflows/${finished.workflow_id}`, { headers })).json();
    expect(workflow.steps.some(step => step.value === 'Saved while offline')).toBeTruthy();
    expect(new Set(workflow.steps.map(step => step.id)).size).toBe(workflow.steps.length);
    expect(workflow.status).toBe('draft');
    expect(fs.existsSync(recorder.manifestPath)).toBeFalsy();
  } finally { await recorder.stop(); }
});

test('New recording launches Chromium from the dashboard and leads to review', async ({ page, request }) => {
  test.setTimeout(60000);
  await page.goto('/');
  await page.getByLabel('Session token').fill('browser-test-session-token');
  await page.getByRole('button', { name: 'Connect to workspace' }).click();
  await page.getByRole('button', { name: 'New recording', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('heading', { name: `Record in ${browserName}` })).toBeVisible();
  await expect(modal.getByText('NO EXTENSION REQUIRED')).toBeVisible();
  await modal.getByLabel('Workflow name').fill(`Dashboard launch ${Date.now()}`);
  await expect(modal.getByLabel('Starting page')).toHaveCount(0);
  await expect(modal.getByRole('button', { name: `Launch ${browserName} & record` })).toBeEnabled();
  await expect(modal.getByLabel(/Describe the workflow/)).toHaveValue('');
  await modal.getByLabel(/Describe the workflow/).fill('Raise a ticket for Claude access in One Connect.');
  await page.screenshot({ path: 'test-results/chromium-setup.png', fullPage: true });
  try {
    await modal.getByRole('button', { name: `Launch ${browserName} & record` }).click();
    await expect(modal.getByRole('button', { name: 'Pause recording', exact: true })).toBeEnabled({ timeout: 30000 });
    const duplicate = await request.post('/api/recorder/start', { headers, data: { title: 'Duplicate', url: 'http://127.0.0.1:8767/start' } });
    expect(duplicate.status()).toBe(409);
    await modal.getByRole('button', { name: 'Pause recording', exact: true }).click();
    await expect(modal.getByRole('button', { name: 'Resume recording', exact: true })).toBeEnabled();
    await modal.getByRole('button', { name: 'Resume recording', exact: true }).click();
    await expect(modal.getByRole('button', { name: 'Pause recording', exact: true })).toBeEnabled();
    await modal.getByRole('button', { name: 'Close recording setup' }).click();
    const bar = page.getByLabel(`${browserName} recorder controls`);
    await expect(bar).toBeVisible();
    await bar.getByRole('button', { name: 'Stop & review' }).click();
    await expect(bar.getByRole('button', { name: 'Review recording', exact: true })).toBeEnabled({ timeout: 20000 });
    await bar.getByRole('button', { name: 'Review recording', exact: true }).click();
    await expect(bar).not.toBeVisible();
    await expect(page.getByLabel('Workflow title')).toHaveValue(/Dashboard launch/);
    await expect(page.getByLabel('Workflow context')).toHaveValue('Raise a ticket for Claude access in One Connect.');
    await expect(page.locator('.step-card')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Waiting for your first step' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export PDF', exact: true })).toBeDisabled();
    await page.screenshot({ path: 'test-results/chromium-review.png', fullPage: true });
  } finally {
    const state = await (await request.get('/api/recorder/status', { headers })).json();
    if (['recording', 'paused'].includes(state.phase)) await request.post('/api/recorder/stop', { headers });
  }
});

import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const headers = { Authorization: 'Bearer browser-test-session-token' };

test('desktop selection, controls, review and exports use desktop context', async ({ page, request }) => {
  const title = `Desktop review ${Date.now()}`;
  const recording_context = 'Create a project folder on the desktop.';
  const workflow = await (await request.post('/api/workflows', { headers, data: { title } })).json();
  const path = `/api/workflows/${workflow.id}`;
  const response = await request.post(path + '/steps', { headers, data: {
    id: randomUUID(), sequence: 1, action: 'click', source: 'desktop', occurred_at: new Date().toISOString(),
    tab_id: 17, url: '', page_title: 'Sample window', app_name: 'sample.exe', label: 'Sample window',
    coordinates: { space: 'desktop', x: 1180, y: 250, screen_x: -100, screen_y: 50,
      desktop_left: -1280, desktop_top: -200, desktop_width: 3200, desktop_height: 1280 },
  } });
  expect(response.ok()).toBeTruthy();
  let state = { phase: 'idle', mode: 'browser', count: 0, pending: 0, available: true, browser_available: true, desktop_available: true };
  // Native Windows hooks run in a separate process; exercise their API/UI contract here.
  await page.route('**/api/recorder/**', async route => {
    const action = route.request().url().split('/').pop();
    if (action === 'start') {
      expect(route.request().postDataJSON()).toEqual({ title, mode: 'desktop', recording_context });
      state = { ...state, phase: 'recording', mode: 'desktop', workflow_id: workflow.id, title, count: 1 };
    }
    if (action === 'pause') state = { ...state, phase: 'paused' };
    if (action === 'resume') state = { ...state, phase: 'recording' };
    if (action === 'stop') {
      await request.post(path + '/stop', { headers });
      state = { ...state, phase: 'done' };
    }
    await route.fulfill({ json: state });
  });
  await page.goto('/');
  await page.getByLabel('Session token').fill('browser-test-session-token');
  await page.getByRole('button', { name: 'Connect to workspace' }).click();
  await page.getByRole('button', { name: 'New recording', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('button', { name: 'Whole desktop', exact: true }).click();
  await expect(modal.getByRole('heading', { name: 'Record your whole desktop' })).toBeVisible();
  await expect(modal.getByText(/Screenshots show visible content/)).toBeVisible();
  await modal.getByLabel('Workflow name').fill(title);
  await modal.getByLabel(/Describe the workflow/).fill(recording_context);
  await modal.getByRole('button', { name: 'Browser tabs', exact: true }).click();
  await expect(modal.getByLabel(/Describe the workflow/)).toHaveValue(recording_context);
  await modal.getByRole('button', { name: 'Whole desktop', exact: true }).click();
  await page.screenshot({ path: 'test-results/desktop-setup.png', fullPage: true });
  await modal.getByRole('button', { name: 'Start desktop recording' }).click();
  await modal.getByRole('button', { name: 'Pause recording', exact: true }).click();
  await modal.getByRole('button', { name: 'Resume recording', exact: true }).click();
  await modal.getByRole('button', { name: 'Close recording setup' }).click();
  const bar = page.getByLabel('Desktop recorder controls');
  await bar.getByRole('button', { name: 'Stop & review' }).click();
  await bar.getByRole('button', { name: 'Review recording' }).click();
  await expect(page.getByLabel('Workflow title')).toHaveValue(title);
  await expect(page.getByText('Desktop app: sample.exe', { exact: true })).toBeVisible();
  await expect(page.locator('.step-context')).toHaveText('Desktop · sample.exe · Sample window');
  await page.getByText('Captured details', { exact: true }).click();
  await expect(page.getByText('Desktop click: X=1180, Y=250 physical px from combined desktop top-left')).toBeVisible();
  await page.getByRole('button', { name: 'Save & verify' }).click();
  for (const name of ['Export PDF', 'Export Word']) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name, exact: true }).click();
    expect(await (await pending).failure()).toBeNull();
  }
  await page.screenshot({ path: 'test-results/desktop-review.png', fullPage: true });
});


test('desktop typed text is visible, editable, verified and exported', async ({ page, request }) => {
  const title = `Typed text ${Date.now()}`;
  const workflow = await (await request.post('/api/workflows', { headers, data: { title } })).json();
  const path = `/api/workflows/${workflow.id}`;
  const value = 'Pankaj <Sales> & team\nApproved';
  const response = await request.post(path + '/steps', { headers, data: {
    id: randomUUID(), sequence: 1, action: 'input', source: 'desktop', occurred_at: new Date().toISOString(),
    tab_id: 17, url: '', page_title: 'Sample window', app_name: 'sample.exe', label: 'Notes',
    value, sensitive: false, text_capture: 'captured',
  } });
  expect(response.ok()).toBeTruthy();
  await request.post(path + '/stop', { headers });
  await page.goto('/');
  await page.getByLabel('Session token').fill('browser-test-session-token');
  await page.getByRole('button', { name: 'Connect to workspace' }).click();
  await page.getByLabel('Search workflows').fill(title);
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: title }) }).click();
  await expect(page.getByLabel('Step 1 instruction')).toHaveValue(`Enter "${value}" in Notes in Sample window.`);
  await page.getByText('Captured details', { exact: true }).click();
  await expect(page.locator('.captured-text')).toContainText(value);
  await page.getByLabel('Step 1 instruction').fill(`Enter "${value}" in Notes, then continue.`);
  await page.getByRole('button', { name: 'Save & verify' }).click();
  for (const name of ['Export PDF', 'Export Word']) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name, exact: true }).click();
    expect(await (await pending).failure()).toBeNull();
  }
  await page.screenshot({ path: 'test-results/desktop-typed-text.png', fullPage: true });
});

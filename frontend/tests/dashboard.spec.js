import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { openDashboard } from '../recorder/dashboard.mjs';

const headers = { Authorization: 'Bearer browser-test-session-token' };

test('edit, verify, prevent stale exports, and preserve named PDF and DOCX downloads after Chromium closes', async ({ request }, testInfo) => {
  const saved = []; const downloadErrors = [];
  const browser = await openDashboard({ url: 'http://127.0.0.1:8765', headless: true, channel: process.env.SOP_TEST_BROWSER_CHANNEL || 'chromium',
    profile: testInfo.outputPath('profile'), directory: testInfo.outputPath('Downloads'),
    onSaved: filename => saved.push(filename), onError: message => downloadErrors.push(message) });
  const page = browser.context.pages()[0];
  try {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const title = `Browser review équipe ${Date.now()}`;
  let response = await request.post('/api/workflows', { headers, data: { title } });
  const workflow = await response.json();
  for (const [index, label] of ['Create workspace', 'Invite teammate'].entries()) {
    response = await request.post(`/api/workflows/${workflow.id}/steps`, { headers, data: {
      id: randomUUID(), sequence: index + 1, action: 'click', occurred_at: new Date().toISOString(),
      tab_id: index + 1, url: 'https://example.org/team', page_title: 'Team workspace', label,
      ...(index === 0 ? { coordinates: { x: 12.5, y: 20, page_x: 12.5, page_y: 420, scroll_x: 0, scroll_y: 400,
        viewport_width: 1280, viewport_height: 900, device_pixel_ratio: 2 } } : {}),
      before: { note: 'Test fixture: no screenshot.' }, after: { note: 'Test fixture: no screenshot.' },
    } });
    expect(response.ok()).toBeTruthy();
  }
  await request.post(`/api/workflows/${workflow.id}/stop`, { headers });
  await page.goto('/');
  await page.getByLabel('Session token').fill('incorrect-token');
  await page.getByRole('button', { name: 'Connect to workspace' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Session token').fill('browser-test-session-token');
  await page.getByRole('button', { name: 'Connect to workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Make knowledge repeatable.' })).toBeVisible();
  await page.screenshot({ path: 'test-results/dashboard.png', fullPage: true });
  await page.getByLabel('Search workflows').fill(title);
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: title }) }).click();
  await expect(page.getByRole('button', { name: 'Export PDF', exact: true })).toBeDisabled();
  await page.locator('.step-card').nth(0).getByText('Captured details', { exact: true }).click();
  await expect(page.getByText('Click position: X=12.5, Y=20 CSS px from viewport top-left', { exact: true })).toBeVisible();
  await expect(page.getByText('Page position: X=12.5, Y=420 CSS px', { exact: true })).toBeVisible();
  await page.locator('.step-card').nth(1).getByText('Captured details', { exact: true }).click();
  await expect(page.getByText('Click coordinates: Not captured', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Improve all steps' }).click();
  await expect(page.getByRole('status')).toContainText('not configured');
  await page.getByLabel('Step 1 instruction').fill('Select Create workspace to open the form.');
  await page.locator('.step-card').nth(0).getByRole('button', { name: 'Save & verify' }).click();
  await expect(page.locator('.step-card').nth(0).getByText('Verified', { exact: true })).toBeVisible();
  await page.locator('.step-card').nth(1).getByRole('button', { name: 'Save & verify' }).click();
  await expect(page.getByRole('button', { name: 'Export PDF', exact: true })).toBeEnabled();
  // Unsaved edits to a verified step must lock exports immediately.
  await page.getByLabel('Step 1 instruction').fill('Select Create workspace, then enter the team name.');
  await expect(page.getByRole('button', { name: 'Export PDF', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Save & verify' }).click();
  await expect(page.getByRole('button', { name: 'Export PDF', exact: true })).toBeEnabled();
  for (const button of ['Export PDF', 'Export Word', 'Export PDF']) {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: button, exact: true }).click();
    const download = await downloadPromise;
    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toBe(`${title}.${button === 'Export PDF' ? 'pdf' : 'docx'}`);
    await browser.downloads.waitForIdle();
  }
  await page.screenshot({ path: 'test-results/editor.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
  await browser.close();
  expect(downloadErrors).toEqual([]);
  expect(saved.map(filename => path.basename(filename))).toEqual([`${title}.pdf`, `${title}.docx`, `${title} (1).pdf`]);
  expect(fs.readFileSync(saved[0]).subarray(0, 4).toString()).toBe('%PDF');
  expect(fs.readFileSync(saved[1]).subarray(0, 2).toString()).toBe('PK');
  expect(fs.readFileSync(saved[2]).subarray(0, 4).toString()).toBe('%PDF');
  } finally { await browser.close(); }
});

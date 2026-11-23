import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const headers = { Authorization: 'Bearer browser-test-session-token' };
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAIAAADBrGu+AAAAXUlEQVR4nNXOMREAIBDAsFL/6phxgAlE/MA1CrLO3ZRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMT5OzD1ACoFAulYrsMjAAAAAElFTkSuQmCC';

test('whole SOP visual review polls progress and supports single or all suggestions', async ({ page, request }) => {
  const title = `Entire visual SOP ${Date.now()}`;
  let w = await (await request.post('/api/workflows', { headers, data: { title } })).json();
  for (let i = 1; i <= 2; i++) {
    const response = await request.post(`/api/workflows/${w.id}/steps`, { headers, data: {
      id: randomUUID(), sequence: i, action: 'click', occurred_at: new Date().toISOString(), tab_id: 1,
      url: 'https://example.org', page_title: 'Employee search', label: i === 1 ? 'Search field' : 'Search',
      before: { data_url: pixel }, after: { data_url: pixel },
    } });
    expect(response.ok()).toBeTruthy();
  }
  w = await (await request.post(`/api/workflows/${w.id}/stop`, { headers })).json();
  const originals = w.steps.map(s => s.description);
  let starts = 0, polls = 0;
  const applications = [];
  await page.route(`**/api/workflows/${w.id}`, async route => {
    if (w.vision_review?.status === 'processing' && ++polls >= 2) w.vision_review.status = 'ready';
    await route.fulfill({ json: w });
  });
  await page.route(`**/api/workflows/${w.id}/vision-review`, async route => {
    const body = route.request().postDataJSON();
    expect(body.version).toBe(w.version);
    if (route.request().method() === 'POST') {
      starts++;
      if (starts === 1) { await route.fulfill({ status: 503, json: { detail: 'OpenAI is unavailable. Your SOP is unchanged.' } }); return; }
      w = structuredClone(w); w.version++;
      w.vision_review = {
        id: randomUUID(), status: 'processing', phase: 'steps', progress: 0, total: 2, basis_version: w.version,
        applied_step_ids: [], applied_fields: [], skipped_step_ids: [], error: '', model: 'vision-fixture',
        overview: { description: 'Find employee records.', purpose: 'Locate the correct employee.', scope: 'Search through the employee directory.', prerequisites: 'Have an employee ID ready.', warning: '' },
        steps: w.steps.map((s, i) => ({ step_id: s.id, description: i === 0 ? 'Select the Employee Search field.' : 'Click Search to display matching employees.', purpose: 'Find the employee record.', expected_result: 'Matching records should appear.', validation: 'Check the employee ID.', notes: '', evidence: 'The control is visible in the before screenshot.', warning: i === 0 ? 'Check the field before continuing.' : '', image_phases: ['before', 'after'] })),
      };
    } else {
      applications.push(body);
      w = structuredClone(w); w.version++;
      for (const id of body.step_ids) {
        const draft = w.vision_review.steps.find(s => s.step_id === id);
        const step = w.steps.find(s => s.id === id);
        step.description = draft.description; step.reviewed = false; step.edited = true;
        step.sop_details = Object.fromEntries(['purpose', 'expected_result', 'validation', 'notes'].map(k => [k, draft[k]]));
      }
      for (const field of body.fields) w[field] = w.vision_review.overview[field];
      w.vision_review.applied_step_ids.push(...body.step_ids);
      w.vision_review.applied_fields.push(...body.fields);
      w.vision_review.basis_version = w.version;
    }
    await route.fulfill({ status: route.request().method() === 'POST' ? 202 : 200, json: w });
  });
  await page.goto('/');
  await page.getByLabel('Session token').fill('browser-test-session-token');
  await page.getByRole('button', { name: 'Connect to workspace' }).click();
  await page.getByLabel('Search workflows').fill(title);
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: title }) }).click();
  const review = page.getByRole('region', { name: 'Whole SOP visual review' });
  const start = review.getByRole('button', { name: 'Improve entire SOP with Vision' });
  await page.getByLabel('Purpose', { exact: true }).fill('Unsaved purpose');
  await expect(start).toBeDisabled();
  await page.getByLabel('Purpose', { exact: true }).fill('');
  await page.getByLabel('Step 1 instruction', { exact: true }).fill('Unsaved instruction');
  await expect(start).toBeDisabled();
  await page.getByLabel('Step 1 instruction', { exact: true }).fill(originals[0]);
  await start.click();
  await expect(page.getByRole('alert')).toContainText('Your SOP is unchanged');
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await start.click();
  await expect(start).toBeDisabled();
  await expect(page.getByLabel('Step 1 instruction', { exact: true })).toBeDisabled();
  await expect(review.getByRole('heading', { name: 'Review suggested changes' })).toBeVisible({ timeout: 15000 });
  const results = review.locator('.workflow-vision-results');
  const resultsToggle = results.locator(':scope > summary');
  await expect(results).toHaveAttribute('open', '');
  await resultsToggle.click();
  await expect(results).not.toHaveAttribute('open', '');
  await resultsToggle.focus();
  await page.keyboard.press('Enter');
  await expect(results).toHaveAttribute('open', '');
  await expect(page.getByLabel('Step 1 instruction', { exact: true })).toHaveValue(originals[0]);
  await review.locator('summary').filter({ hasText: /^Step 1:/ }).click();
  await expect(review).toContainText('Current instruction');
  await review.locator('summary').filter({ hasText: /^Step 2:/ }).click();
  await review.getByLabel('Use visual suggestion for step 2', { exact: true }).uncheck();
  await review.getByRole('button', { name: 'Apply only step 1', exact: true }).click();
  await expect(review.getByLabel('Use visual suggestion for step 2', { exact: true })).not.toBeChecked();
  await expect(page.getByLabel('Step 1 instruction', { exact: true })).toHaveValue('Select the Employee Search field.');
  await expect(page.getByLabel('Step 2 instruction', { exact: true })).toHaveValue(originals[1]);
  expect(applications[0].step_ids).toEqual([w.steps[0].id]);
  expect(applications[0].fields).toEqual([]);
  await expect(results).toHaveAttribute('open', '');
  await review.locator('summary').filter({ hasText: /^Purpose$/ }).click();
  await review.screenshot({ path: 'test-results/whole-sop-vision-review.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await review.getByRole('button', { name: 'Apply all suggestions', exact: true }).click();
  await expect(page.getByLabel('Purpose', { exact: true })).toHaveValue('Locate the correct employee.');
  await expect(page.getByLabel('Step 2 instruction', { exact: true })).toHaveValue('Click Search to display matching employees.');
  expect(applications[1].step_ids).toEqual([w.steps[1].id]);
  expect(applications[1].fields).toEqual(['description', 'purpose', 'scope', 'prerequisites']);
  await expect(results).not.toHaveAttribute('open', '');
  await expect(resultsToggle).toContainText('Applied Vision suggestions');
  await expect(review.getByRole('button', { name: 'Apply all suggestions', exact: true })).not.toBeVisible();
  await resultsToggle.click();
  await expect(results).toHaveAttribute('open', '');
  await expect(review.getByRole('button', { name: 'Apply all suggestions', exact: true })).toBeDisabled();
  await expect(review.getByText('Check the field before continuing.', {exact: true})).toBeVisible();
  await resultsToggle.click();
  await page.reload();
  await page.getByLabel('Search workflows').fill(title);
  await page.getByRole('button').filter({has: page.getByRole('heading', {name: title})}).click();
  await expect(resultsToggle).toContainText('Applied Vision suggestions');
  await expect(results).not.toHaveAttribute('open', '');
  await review.screenshot({path: 'test-results/whole-sop-vision-collapsed.png'});

  await expect(page.getByRole('button', { name: 'Export PDF', exact: true })).toBeDisabled();
  w.version++; // An edit from another tab invalidates this review.
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(review).toContainText('The workflow changed. Run a new visual review');
});

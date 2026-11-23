import {test, expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
const headers = {Authorization: 'Bearer browser-test-session-token'};
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAIAAADBrGu+AAAAXUlEQVR4nNXOMREAIBDAsFL/6phxgAlE/MA1CrLO3ZRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMT5OzD1ACoFAulYrsMjAAAAAElFTkSuQmCC';

async function seed(request, title, automatic) {
  const w = await (await request.post('/api/workflows', {headers, data: {title}})).json();
  const group = randomUUID();
  for (const [index, value] of ['one', 'one con', 'one connect'].entries()) {
    const response = await request.post(`/api/workflows/${w.id}/steps`, {headers, data: {
      id: randomUUID(), sequence: index + 1, action: 'input', source: 'desktop', value,
      text_capture: 'captured', tab_id: 11, app_name: 'sample.exe', page_title: 'Search', label: 'Search field', url: '',
      occurred_at: new Date(Date.now() + index * 5000).toISOString(),
      desktop_target: {auto_id: 'search', control_type: 'Edit'},
      input_group_id: automatic ? group : null, desktop_field_id: automatic ? [42, 1] : null,
      before: {data_url: pixel}, after: {data_url: pixel},
    }});
    expect(response.ok(), await response.text()).toBeTruthy();
  }
  return (await request.post(`/api/workflows/${w.id}/stop`, {headers})).json();
}

async function open(page, title) {
  await page.goto('/');
  await page.getByLabel('Session token').fill('browser-test-session-token');
  await page.getByRole('button', {name: 'Connect to workspace'}).click();
  await page.getByLabel('Search workflows').fill(title);
  await page.getByRole('button').filter({has: page.getByRole('heading', {name: title})}).click();
}

test('manual merge previews the final text and restores originals after refresh', async ({page, request}) => {
  const title = `Merge typing ${Date.now()}`;
  const w = await seed(request, title, false);
  await open(page, title);
  const merge = page.getByRole('region', {name: 'Merge typing steps'});
  await expect(page.locator('.step-card')).toHaveCount(3);
  await page.getByLabel('Select step 1 for merging', {exact: true}).check();
  await page.getByLabel('Select step 3 for merging', {exact: true}).check();
  await expect(merge).toContainText('without another action between them');
  await expect(merge.getByRole('button', {name: 'Merge selected typing steps'})).toBeDisabled();
  await page.getByLabel('Select step 2 for merging', {exact: true}).check();
  await expect(merge.locator('pre')).toHaveText('"one connect"');
  await expect(merge.getByRole('button', {name: 'Merge selected typing steps'})).toBeDisabled();
  await merge.getByLabel('I confirm these are updates to the same field in one typing action.').check();
  await merge.getByRole('button', {name: 'Merge selected typing steps'}).click();
  await expect(page.locator('.step-card')).toHaveCount(1);
  await expect(page.getByLabel('Step 1 instruction', {exact: true})).toHaveValue('Enter "one connect" in Search field in Search.');
  await expect(page.getByRole('button', {name: 'Export PDF', exact: true})).toBeDisabled();
  await expect(page.locator('.step-card img')).toHaveCount(2);
  await page.getByRole('button', {name: 'Refresh', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Undo merge', exact: true})).toBeEnabled();
  await page.screenshot({path: 'test-results/merged-typing.png', fullPage: true});
  await page.getByRole('button', {name: 'Undo merge', exact: true}).click();
  await expect(page.locator('.merge-history')).toContainText('Wording changes to this combined step will be discarded');
  await page.getByRole('button', {name: 'Restore original steps', exact: true}).click();
  await expect(page.locator('.step-card')).toHaveCount(3);
  const restored = await (await request.get(`/api/workflows/${w.id}`, {headers})).json();
  expect(restored.steps.map(step => step.id)).toEqual(w.steps.map(step => step.id));
  expect(restored.steps.map(step => step.value)).toEqual(['one', 'one con', 'one connect']);
});

test('automatic desktop consolidation is visible and can be undone', async ({page, request}) => {
  const title = `Auto typing ${Date.now()}`;
  const w = await seed(request, title, true);
  expect(w.steps).toHaveLength(1);
  await open(page, title);
  await expect(page.locator('.merge-history')).toContainText('3 typing updates combined automatically');
  await page.getByRole('button', {name: 'Undo merge', exact: true}).click();
  await page.getByRole('button', {name: 'Restore original steps', exact: true}).click();
  await expect(page.locator('.step-card')).toHaveCount(3);
  await page.setViewportSize({width: 390, height: 844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

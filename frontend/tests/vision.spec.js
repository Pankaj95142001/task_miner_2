import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

let createdWorkflow;
test.afterEach(async ({ request }) => { if (createdWorkflow) await request.post(`/api/workflows/${createdWorkflow}/stop`, { headers }); });
const headers = { Authorization: 'Bearer browser-test-session-token' };
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAIAAADBrGu+AAAAXUlEQVR4nNXOMREAIBDAsFL/6phxgAlE/MA1CrLO3ZRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMRJnMT5OzD1ACoFAulYrsMjAAAAAElFTkSuQmCC';

test('visual review preserves the original until selected suggestions are applied', async ({ page, request }) => {
  const title = `Vision UI ${Date.now()}`;
  let w = await (await request.post('/api/workflows', { headers, data: { title } })).json();
  createdWorkflow = w.id;
  const create = await request.post(`/api/workflows/${w.id}/steps`, { headers, data: {
    id: randomUUID(), sequence: 1, action: 'click', occurred_at: new Date().toISOString(), tab_id: 1,
    url: 'https://example.org/form', page_title: 'Form', label: 'Save', selector: 'button:nth-child(2)',
    before: { data_url: pixel }, after: { data_url: pixel },
    browser_target: { tag:'button',role:'button',name:'Save',candidates:[{selector:'#save',strategy:'id'}],rect:{x:10,y:20,width:100,height:40},viewport_width:640,viewport_height:400 },
  } });
  expect(create.ok(), await create.text()).toBeTruthy();
  w = await (await request.post(`/api/workflows/${w.id}/stop`, { headers })).json();
  const original = w.steps[0].description;
  let calls = 0;
  await page.route('**/steps/*/vision', async route => {
    const req = route.request(); const body = req.postDataJSON();
    expect(body.version).toBe(w.version);
    if (req.method() === 'POST') {
      calls++;
      if (calls === 1) { await route.fulfill({ status:503,json:{detail:'OpenAI timed out. No steps were changed.'} }); return; }
      w = structuredClone(w); w.version++;
      w.steps[0].vision = { id:'suggestion-fixture',description:'Select Save to submit the form.',selector:'#save',confidence:'high',observation:'The Save button is visible.',warning:'Verify the result.',model:'vision-fixture',basis_description:original,basis_selector:w.steps[0].selector,applied:false };
    } else {
      expect(body.use_description).toBeTruthy(); expect(body.use_selector).toBeFalsy();
      expect(body.suggestion_id).toBe('suggestion-fixture');
      w = structuredClone(w); w.version++;
      w.steps[0].description = w.steps[0].vision.description;
      w.steps[0].reviewed = false; w.steps[0].edited = true; w.steps[0].vision.applied = true;
    }
    await route.fulfill({ json:w });
  });
  await page.goto('/');
  await page.getByLabel('Session token').fill('browser-test-session-token');
  await page.getByRole('button',{name:'Connect to workspace'}).click();
  await page.getByLabel('Search workflows').fill(title);
  await page.getByRole('button').filter({has:page.getByRole('heading',{name:title})}).click();
  await page.getByText('Vision assistance',{exact:true}).click();
  await page.getByRole('button',{name:'Analyze screenshots with OpenAI'}).click();
  await expect(page.getByRole('alert')).toContainText('No steps were changed');
  await expect(page.getByLabel('Step 1 instruction',{exact:true})).toHaveValue(original);
  await page.getByRole('button',{name:'Analyze screenshots with OpenAI'}).click();
  await expect(page.getByLabel('Vision suggestion')).toContainText('Select Save to submit the form.');
  await expect(page.getByLabel('Step 1 instruction',{exact:true})).toHaveValue(original);
  await page.getByLabel('Use suggested selector').uncheck();
  await page.getByRole('button',{name:'Apply selected suggestions'}).click();
  await expect(page.getByLabel('Step 1 instruction',{exact:true})).toHaveValue('Select Save to submit the form.');
  expect(w.steps[0].selector).toBe('button:nth-child(2)');
  await expect(page.getByRole('button',{name:'Export PDF',exact:true})).toBeDisabled();
  await page.screenshot({path:'test-results/vision-review.png',fullPage:true});
});


test('desktop contextual review requires confirmation of recovered input', async ({ page, request }) => {
  const title = `Desktop recovery ${Date.now()}`;
  let w = await (await request.post('/api/workflows', { headers, data: { title } })).json();
  createdWorkflow = w.id;
  const response = await request.post(`/api/workflows/${w.id}/steps`, { headers, data: {
    id: randomUUID(), sequence: 1, action: 'input', source: 'desktop', occurred_at: new Date().toISOString(),
    tab_id: 1, url: '', page_title: 'Downloads', app_name: 'explorer.exe', label: 'Folder name', value: '',
    text_capture: 'captured', before: {data_url: pixel}, after: {data_url: pixel},
    desktop_target: {auto_id:'rename',name:'New folder',control_type:'Edit'},
  }});
  expect(response.ok()).toBeTruthy();
  w = await (await request.post(`/api/workflows/${w.id}/stop`, { headers })).json();
  await page.route('**/steps/*/vision', async route => {
    const body=route.request().postDataJSON();
    expect(body.version).toBe(w.version);
    w=structuredClone(w); w.version++;
    if(route.request().method()==='POST') {
      w.steps[0].vision={id:'desktop-review',description:'Enter "Training Notes" in Folder name.',
        selector:'',confidence:'high',inferred_intent:'Create a folder in Downloads.',
        recovered_value:'Training Notes',recovery_evidence:'After screenshot shows the folder name.',
        sop_note:'Review the folder path in the instruction.',model:'fixture',applied:false,
        basis_description:w.steps[0].description,basis_selector:w.steps[0].selector,context_version:w.version};
    } else {
      expect(body.confirmed_value).toBe('Training Notes 2');
      w.steps[0].value=body.confirmed_value;
      w.steps[0].description='Enter "Training Notes 2" in Folder name.';
      w.steps[0].vision.applied=true;
    }
    await route.fulfill({json:w});
  });
  await page.goto('/');
  await page.getByLabel('Session token').fill('browser-test-session-token');
  await page.getByRole('button',{name:'Connect to workspace'}).click();
  await page.getByLabel('Search workflows').fill(title);
  await page.getByRole('button').filter({has:page.getByRole('heading',{name:title})}).click();
  await page.getByText('Vision assistance',{exact:true}).click();
  await page.getByRole('button',{name:'Analyze screenshots with OpenAI'}).click();
  await expect(page.getByLabel('Vision suggestion')).toContainText('Create a folder in Downloads');
  const value=page.getByLabel('Recovered or corrected text',{exact:true});
  await expect(value).toHaveValue('Training Notes');
  const confirm=page.getByLabel('I confirm this exact input value, including an empty value if intended');
  await expect(confirm).not.toBeChecked();
  await page.getByLabel('Use suggested instruction').uncheck();
  await expect(page.getByRole('button',{name:'Apply selected suggestions'})).toBeDisabled();
  await confirm.check();
  await value.fill('Training Notes 2');
  await expect(confirm).not.toBeChecked();
  await confirm.check();
  await page.getByRole('button',{name:'Apply selected suggestions'}).click();
  await expect(page.getByLabel('Step 1 instruction',{exact:true})).toHaveValue('Enter "Training Notes 2" in Folder name.');
  await page.screenshot({path:'test-results/desktop-vision-recovery.png',fullPage:true});
});


async function createSteps(request, title, overrides) {
  let w = await (await request.post('/api/workflows', { headers, data: { title } })).json();
  createdWorkflow = w.id;
  for (const [index, changes] of overrides.entries()) {
    const response = await request.post(`/api/workflows/${w.id}/steps`, { headers, data: {
      id: randomUUID(), sequence: index + 1, action: 'click', occurred_at: new Date().toISOString(),
      tab_id: 1, url: 'https://example.org/form', page_title: 'Form', label: 'Save', selector: '#save',
      before: {data_url: pixel}, after: {data_url: pixel}, ...changes,
    }});
    expect(response.ok(), await response.text()).toBeTruthy();
  }
  return (await request.post(`/api/workflows/${w.id}/stop`, { headers })).json();
}

async function openWorkflow(page, title) {
  await page.goto('/');
  await page.getByLabel('Session token').fill('browser-test-session-token');
  await page.getByRole('button', {name: 'Connect to workspace'}).click();
  await page.getByLabel('Search workflows').fill(title);
  await page.getByRole('button').filter({has: page.getByRole('heading', {name: title})}).click();
}

test('edited step saves before vision and all buttons recover after a failed analysis', async ({page, request}) => {
  const title = `Vision draft ${Date.now()}`;
  const w = await createSteps(request, title, [{}, {}]);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let calls = 0;
  await page.route('**/steps/*/vision', async route => {
    calls++;
    const current = await (await request.get(`/api/workflows/${w.id}`, {headers})).json();
    expect(current.steps[0].description).toBe('Select Save to record your changes.');
    expect(current.steps[0].reviewed).toBeFalsy();
    expect(route.request().postDataJSON().version).toBe(current.version);
    expect(current.version).toBe(w.version + 1);
    if (calls === 1) {
      await pending;
      await route.fulfill({status: 503, json: {detail: 'OpenAI timed out. No steps were changed.'}});
    } else {
      current.version++;
      current.steps[0].vision = {id: 'retry-suggestion', description: 'Choose Save to store your changes.',
        selector: '', confidence: 'high', model: 'fixture', applied: false,
        basis_description: current.steps[0].description, basis_selector: current.steps[0].selector,
        context_version: current.version};
      await route.fulfill({json: current});
    }
  });
  await openWorkflow(page, title);
  const first = page.locator('.step-card').nth(0);
  const second = page.locator('.step-card').nth(1);
  await first.getByText('Vision assistance', {exact: true}).click();
  await second.getByText('Vision assistance', {exact: true}).click();
  await first.getByLabel('Step 1 instruction', {exact: true}).click();
  await expect(first.getByRole('button', {name: 'Analyze screenshots with OpenAI'})).toBeEnabled();
  await first.getByLabel('Step 1 instruction', {exact: true}).fill('Select Save to record your changes.');
  const saveAndAnalyze = first.getByRole('button', {name: 'Save draft & analyze with OpenAI'});
  await expect(saveAndAnalyze).toBeEnabled();
  await expect(second.getByRole('button', {name: 'Analyze screenshots with OpenAI'})).toBeDisabled();
  await expect(second).toContainText('Save edits to other steps');
  await saveAndAnalyze.click();
  await expect(first.getByRole('button', {name: 'Working...'})).toBeDisabled();
  await expect(second.getByRole('button', {name: 'Analyze screenshots with OpenAI'})).toBeDisabled();
  await expect(page.getByRole('button', {name: 'Improve entire SOP with Vision'})).toBeDisabled();
  release();
  await expect(page.getByRole('alert')).toContainText('OpenAI timed out');
  await expect(first).toContainText('Your draft was saved. Vision analysis failed:');
  await expect(first.getByRole('button', {name: 'Analyze screenshots with OpenAI'})).toBeEnabled();
  await expect(second.getByRole('button', {name: 'Analyze screenshots with OpenAI'})).toBeEnabled();
  await expect(page.getByRole('button', {name: 'Improve entire SOP with Vision'})).toBeEnabled();
  await expect(first.getByLabel('Step 1 instruction', {exact: true})).toHaveValue('Select Save to record your changes.');
  await first.getByRole('button', {name: 'Analyze screenshots with OpenAI'}).click();
  await expect(first.getByLabel('Vision suggestion')).toContainText('Choose Save to store your changes.');
  expect(calls).toBe(2);
});

test('vision explains unavailable states and accepts nearby screenshots', async ({page, request}) => {
  const title = `Vision availability ${Date.now()}`;
  await createSteps(request, title, [
    {before: {}, after: {}}, {}, {sensitive: true}, {before: {}, after: {}},
  ]);
  await openWorkflow(page, title);
  const cards = page.locator('.step-card');
  for (let index = 0; index < 4; index++) {
    await cards.nth(index).getByText('Vision assistance', {exact: true}).click();
  }
  const contextual = cards.nth(0).getByRole('button', {name: 'Analyze screenshots with OpenAI'});
  await expect(contextual).toBeEnabled();
  await expect(cards.nth(0)).toContainText('Vision will use adjacent screenshots as context');
  await expect(cards.nth(2).getByRole('button', {name: 'Analyze screenshots with OpenAI'})).toBeDisabled();
  await expect(cards.nth(2)).toContainText('private or protected steps');
  await expect(cards.nth(3).getByRole('button', {name: 'Analyze screenshots with OpenAI'})).toBeDisabled();
  await expect(cards.nth(3)).toContainText('No screenshots are available');
  await expect(cards.nth(3).getByRole('button', {name: 'Improve this step'})).toBeEnabled();
  await page.getByLabel('Workflow title', {exact: true}).fill(title + ' edited');
  await expect(contextual).toBeDisabled();
  await expect(cards.nth(0)).toContainText('Save SOP details before using Vision.');
  await page.getByRole('button', {name: 'Save SOP details', exact: true}).click();
  await expect(contextual).toBeEnabled();
  const instruction = cards.nth(0).getByLabel('Step 1 instruction', {exact: true});
  const original = await instruction.inputValue();
  await instruction.fill('   ');
  await expect(cards.nth(0).getByRole('button', {name: 'Save draft & analyze with OpenAI'})).toBeDisabled();
  await expect(cards.nth(0)).toContainText('Enter an instruction before saving and analyzing.');
  await instruction.fill(original);
  await expect(contextual).toBeEnabled();
  await page.screenshot({path: 'test-results/vision-availability.png', fullPage: true});
});

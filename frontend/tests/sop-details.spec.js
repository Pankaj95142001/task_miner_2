import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const headers={Authorization:'Bearer browser-test-session-token'};

test('purpose, scope and prerequisites persist across reload and export after saving',async({page,request})=>{
  const title=`SOP details ${Date.now()}`;
  const w=await (await request.post('/api/workflows',{headers,data:{title}})).json();
  await request.post(`/api/workflows/${w.id}/steps`,{headers,data:{id:randomUUID(),sequence:1,action:'click',occurred_at:new Date().toISOString(),tab_id:1,url:'https://example.org',label:'Save'}});
  await request.post(`/api/workflows/${w.id}/stop`,{headers});
  await page.goto('/');
  await page.getByLabel('Session token').fill('browser-test-session-token');
  await page.getByRole('button',{name:'Connect to workspace'}).click();
  await page.getByLabel('Search workflows').fill(title);
  await page.getByRole('button').filter({has:page.getByRole('heading',{name:title})}).click();
  await page.getByRole('button',{name:'Save & verify',exact:true}).click();
  await expect(page.getByRole('button',{name:'Export PDF',exact:true})).toBeEnabled();
  await page.getByLabel('Workflow context').fill('Create a consistent folder structure in Downloads.');
  await expect(page.getByRole('button',{name:'Export PDF',exact:true})).toBeDisabled();
  await page.getByLabel('Purpose',{exact:true}).fill('Create a consistent folder structure.');
  await page.getByLabel('Scope',{exact:true}).fill('Windows Downloads folder.\nExcludes deletion.');
  await expect(page.getByRole('button',{name:'Export PDF',exact:true})).toBeDisabled();
  await page.getByLabel('Prerequisites',{exact:true}).fill('Windows access and write permission.');
  await page.getByRole('button',{name:'Save SOP details',exact:true}).click();
  await expect(page.getByRole('button',{name:'Export PDF',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await expect(page.getByLabel('Workflow context')).toHaveValue('Create a consistent folder structure in Downloads.');
  await expect(page.getByLabel('Overview (optional)')).toHaveValue('');
  await expect(page.getByLabel('Purpose',{exact:true})).toHaveValue('Create a consistent folder structure.');
  await expect(page.getByLabel('Scope',{exact:true})).toHaveValue('Windows Downloads folder.\nExcludes deletion.');
  await expect(page.getByLabel('Prerequisites',{exact:true})).toHaveValue('Windows access and write permission.');
  for(const name of ['Export PDF','Export Word']){
    const download=page.waitForEvent('download');
    await page.getByRole('button',{name,exact:true}).click();
    expect(await (await download).failure()).toBeNull();
  }
  await page.screenshot({path:'test-results/sop-purpose-scope.png',fullPage:true});
});

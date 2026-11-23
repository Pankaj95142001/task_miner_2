import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const headers = { Authorization: 'Bearer browser-test-session-token' };

test('improve current or all steps with explicit inclusion and unsaved-edit protection', async ({page,request}) => {
 const title = `Improve choices ${Date.now()}`;
 let w = await (await request.post('/api/workflows', {headers,data:{title}})).json();
 for(let i=1;i<=2;i++) {
  const result = await request.post(`/api/workflows/${w.id}/steps`, {headers,data:{id:randomUUID(),sequence:i,action:'click',occurred_at:new Date().toISOString(),tab_id:1,url:'https://example.org',label:i===1?'Save':'Continue'}});
  expect(result.ok()).toBeTruthy();
 }
 w=await (await request.post(`/api/workflows/${w.id}/stop`,{headers})).json();
 const originalSecond=w.steps[1].description;
 const calls=[];
 await page.route('**/clean',async route=>{
  const url=new URL(route.request().url());
  const body=route.request().postDataJSON();
  expect(body.version).toBe(w.version);
  const single=url.pathname.includes('/steps/');
  calls.push({single,...body});
  if(calls.length===1){ await route.fulfill({json:{mode:'fallback',message:'OpenAI unavailable. No steps were changed.',workflow:w}});return; }
  w=structuredClone(w);w.version++;
  w.steps=w.steps.map((s,i)=>single&&i!==0?s:{...s,description:single?'Select Save to continue.':`Improved instruction ${i+1}.`,reviewed:false});
  await route.fulfill({json:{mode:'openai',message:'Instructions improved. Review before exporting.',workflow:w}});
 });
 await page.goto('/');
 await page.getByLabel('Session token').fill('browser-test-session-token');
 await page.getByRole('button',{name:'Connect to workspace'}).click();
 await page.getByLabel('Search workflows').fill(title);
 await page.getByRole('button').filter({has:page.getByRole('heading',{name:title})}).click();
 const current=page.getByRole('button',{name:'Improve this step',exact:true}).first();
 const all=page.getByRole('button',{name:'Improve all steps',exact:true});
 await page.getByLabel('Purpose',{exact:true}).fill('Unsaved purpose');
 await expect(current).toBeDisabled();await expect(all).toBeDisabled();
 await page.getByLabel('Purpose',{exact:true}).fill('');
 await page.getByLabel('Step 1 instruction',{exact:true}).fill('Unsaved instruction');
 await expect(current).toBeDisabled();await expect(all).toBeDisabled();
 await page.getByLabel('Step 1 instruction',{exact:true}).fill(w.steps[0].description);
 await current.click();
 await expect(page.getByRole('status')).toContainText('No steps were changed');
 await expect(page.getByLabel('Step 1 instruction',{exact:true})).toHaveValue(w.steps[0].description);
 await current.click();
 await expect(page.getByLabel('Step 1 instruction',{exact:true})).toHaveValue('Select Save to continue.');
 await expect(page.getByLabel('Step 2 instruction',{exact:true})).toHaveValue(originalSecond);
 await page.getByLabel('Include edited and verified steps').check();
 await all.click();
 await expect(page.getByLabel('Step 1 instruction',{exact:true})).toHaveValue('Improved instruction 1.');
 await expect(page.getByLabel('Step 2 instruction',{exact:true})).toHaveValue('Improved instruction 2.');
 expect(calls.map(c=>c.single)).toEqual([true,true,false]);
 expect(calls[2].include_edited_and_verified).toBe(true);
 await expect(page.getByRole('button',{name:'Export PDF',exact:true})).toBeDisabled();
 await page.screenshot({path:'test-results/improve-steps.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

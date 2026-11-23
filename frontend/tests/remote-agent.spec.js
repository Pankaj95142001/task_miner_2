import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const headers={Authorization:'Bearer browser-test-session-token'};

test('remote recorder download and SOP review without replay controls',async({page,request})=>{
  const title=`Remote agent ${Date.now()}`;
  let w=await (await request.post('/api/workflows',{headers,data:{title}})).json();
  const created=await request.post(`/api/workflows/${w.id}/steps`,{headers,data:{
    id:randomUUID(),sequence:1,action:'click',source:'desktop',occurred_at:new Date().toISOString(),
    tab_id:2,url:'',page_title:'Remote sample',app_name:'sample.exe',label:'Save',
    capture_host:{kind:'remote_agent',agent_id:randomUUID(),machine:'REMOTE-TEST'},
    desktop_target:{auto_id:'saveButton',name:'Save',control_type:'Button'},
  }});
  expect(created.ok()).toBeTruthy();
  w=await (await request.post(`/api/workflows/${w.id}/stop`,{headers})).json();
  await page.goto('/');
  await page.getByLabel('Session token').fill('browser-test-session-token');
  await page.getByRole('button',{name:'Connect to workspace'}).click();
  await page.getByRole('button',{name:'New recording',exact:true}).click();
  await page.getByText('Record inside Remote Desktop (RDP)',{exact:true}).click();
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download remote recorder'}).click();
  const download=await pending;
  expect(download.suggestedFilename()).toBe('sop-remote-recorder.zip');
  expect(await download.failure()).toBeNull();
  await page.getByRole('button',{name:'Close recording setup'}).click();
  await page.getByLabel('Search workflows').fill(title);
  await page.getByRole('button').filter({has:page.getByRole('heading',{name:title})}).click();
  await page.getByText('Captured details',{exact:true}).click();
  await expect(page.getByText('Recorded on remote machine: REMOTE-TEST',{exact:true})).toBeVisible();
  await expect(page.getByText('Automation ID: saveButton',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Review automation plan'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Start replay',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Save & verify',exact:true}).click();
  await expect(page.getByRole('button',{name:'Export PDF',exact:true})).toBeEnabled();
  await page.screenshot({path:'test-results/remote-agent-dashboard.png',fullPage:true});
});

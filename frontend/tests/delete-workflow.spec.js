import { test, expect } from '@playwright/test';
const headers={Authorization:'Bearer browser-test-session-token'};

async function seed(request,title) {
  const result=await request.post('/api/workflows',{headers,data:{title}});
  expect(result.ok()).toBeTruthy();const w=await result.json();
  return (await request.post(`/api/workflows/${w.id}/stop`,{headers})).json();
}
async function connect(page) {
  await page.goto('/');await page.getByLabel('Session token').fill('browser-test-session-token');
  await page.getByRole('button',{name:'Connect to workspace'}).click();
}

test('delete from library requires confirmation and removes the workflow permanently',async({page,request})=>{
  const title=`Delete fixture ${Date.now()}`;const w=await seed(request,title);
  await connect(page);await page.getByLabel('Search workflows').fill(title);
  await page.getByRole('button',{name:`Delete workflow ${title}`,exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Permanently delete this workflow?'});
  await expect(dialog).toContainText('This cannot be undone');
  await expect(dialog).toContainText('Downloads folder');
  await expect(dialog.getByRole('button',{name:'Cancel',exact:true})).toBeFocused();
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  expect((await request.get(`/api/workflows/${w.id}`,{headers})).status()).toBe(200);
  await page.getByRole('button',{name:`Delete workflow ${title}`,exact:true}).click();
  await page.screenshot({path:'test-results/workflow-delete-dialog.png',fullPage:true});
  await dialog.getByRole('button',{name:'Delete permanently',exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('heading',{name:title,exact:true})).toHaveCount(0);
  expect((await request.get(`/api/workflows/${w.id}`,{headers})).status()).toBe(404);
  await page.reload();await expect(page.getByRole('heading',{name:title,exact:true})).toHaveCount(0);
});

test('editor delete reports a stale version before allowing a refreshed deletion',async({page,request})=>{
  const title=`Delete editor ${Date.now()}`;let w=await seed(request,title);
  await connect(page);await page.getByLabel('Search workflows').fill(title);
  await page.getByRole('button').filter({has:page.getByRole('heading',{name:title})}).click();
  await page.getByRole('button',{name:'Delete workflow',exact:true}).click();
  w=await (await request.patch(`/api/workflows/${w.id}`,{headers,data:{version:w.version,title,description:'Edited in another tab'}})).json();
  const dialog=page.getByRole('dialog',{name:'Permanently delete this workflow?'});
  await dialog.getByRole('button',{name:'Delete permanently',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('changed');
  expect((await request.get(`/api/workflows/${w.id}`,{headers})).status()).toBe(200);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await expect(page.getByLabel('Overview (optional)')).toHaveValue('Edited in another tab');
  await page.getByRole('button',{name:'Delete workflow',exact:true}).click();
  await dialog.getByRole('button',{name:'Delete permanently',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Make knowledge repeatable.'})).toBeVisible();
  expect((await request.get(`/api/workflows/${w.id}`,{headers})).status()).toBe(404);
});

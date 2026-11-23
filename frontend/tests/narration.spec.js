import {test,expect} from '@playwright/test';
import {chromium} from 'playwright';
import {randomUUID} from 'node:crypto';
const headers={Authorization:'Bearer browser-test-session-token'};

test('fake microphone records WebM with screen workflow and retains audio when OpenAI is unavailable',async({request})=>{
 const w=await(await request.post('/api/workflows',{headers,data:{title:`Voice capture ${Date.now()}`}})).json();
 let state={phase:'idle',mode:'browser',available:true,browser_available:true,desktop_available:true,browser_channel:'msedge',count:0,pending:0,recoverable:false};
 const browser=await chromium.launch({channel:process.env.SOP_TEST_BROWSER_CHANNEL||'chromium',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 const context=await browser.newContext({baseURL:'http://127.0.0.1:8765',permissions:['microphone']});
 const page=await context.newPage();
 try{
 await page.route('**/api/recorder/**',async route=>{
  const action=new URL(route.request().url()).pathname.split('/').pop();
  if(action==='start')state={...state,phase:'recording',workflow_id:w.id,title:w.title};
  if(action==='pause')state={...state,phase:'paused'};
  if(action==='resume')state={...state,phase:'recording'};
  if(action==='stop'){await request.post(`/api/workflows/${w.id}/stop`,{headers});state={...state,phase:'done'};}
  await route.fulfill({json:state});
 });
 await page.addInitScript(()=>{
   // Generated audio exercises real MediaRecorder/IndexedDB/upload without accessing a physical microphone.
   navigator.mediaDevices.getUserMedia=async()=>{
     const audio=new AudioContext();const tone=audio.createOscillator();const output=audio.createMediaStreamDestination();
     tone.connect(output);tone.start();await audio.resume();window.__testAudio=audio;return output.stream;
   };
 });
 await page.goto('/');await page.getByLabel('Session token').fill('browser-test-session-token');
 await page.getByRole('button',{name:'Connect to workspace'}).click();
 await page.getByRole('button',{name:'New recording',exact:true}).click();
 await page.getByLabel('Workflow name',{exact:true}).fill(w.title);
 await page.getByLabel('Record voice narration',{exact:true}).check();
 await page.getByRole('button',{name:'Launch Microsoft Edge & record',exact:true}).click();
 await expect(page.getByText('Microphone recording',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Mute microphone',exact:true}).click();
 await expect(page.getByText('Microphone muted',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Unmute microphone',exact:true}).click();
 await expect(page.getByText('Microphone recording',{exact:true})).toBeVisible();
 const step={id:randomUUID(),sequence:1,action:'click',occurred_at:new Date().toISOString(),tab_id:1,url:'https://example.org',label:'Search'};
 await request.post(`/api/workflows/${w.id}/steps`,{headers,data:step});
 // Allow one MediaRecorder chunk to be produced and backed up to IndexedDB.
 await expect.poll(async()=>page.evaluate(()=>new Promise(resolve=>{
  const open=indexedDB.open('sop-narration',1);open.onsuccess=()=>{const db=open.result;const req=db.transaction('drafts').objectStore('drafts').get('current');req.onsuccess=()=>{resolve(req.result?.bytes||0);db.close();};};
 })),{timeout:15000}).toBeGreaterThan(100);
 await page.getByRole('button',{name:'Stop & review',exact:true}).click();
 await expect(page.getByText('Narration saved',{exact:true}).first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Review recording',exact:true})).toBeEnabled();
 const saved=await(await request.get(`/api/workflows/${w.id}`,{headers})).json();
 expect(saved.narration.status).toBe('uploaded');expect(saved.narration.duration).toBeGreaterThan(1);
 const audio=await request.get(`/api/workflows/${w.id}/narration/audio`,{headers});
 expect((await audio.body()).subarray(0,4).toString('hex')).toBe('1a45dfa3');
 await page.getByRole('button',{name:'Review recording',exact:true}).click();
 await expect(page.getByText('Voice narration',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Transcribe and compare narration'})).toBeVisible();
 await page.screenshot({path:'test-results/narration-capture.png',fullPage:true});
 }finally{await browser.close();}
});

test('narration mismatch requires review before applying evidence-backed suggestions',async({page,request})=>{
 let w=await(await request.post('/api/workflows',{headers,data:{title:`Voice review ${Date.now()}`}})).json();
 const id=randomUUID();await request.post(`/api/workflows/${w.id}/steps`,{headers,data:{id,sequence:1,action:'input',occurred_at:new Date().toISOString(),tab_id:1,url:'https://example.org',label:'Employee ID',value:'12354'}});
 w=await(await request.post(`/api/workflows/${w.id}/stop`,{headers})).json();
 w.narration={status:'ready',transcribed:true,duration:10,segments:[{id:'group-1',start:0,end:10,transcript:'Enter employee ID 12345.',step_ids:[id],confirmed:false,comparison:{status:'mismatch',reason:'The spoken value differs from the recorded value.',suggestions:[{step_id:id,description:'Enter "12354" in Employee ID.',purpose:'Find the employee record.',expected_result:'Matching records should appear.',validation:'Check the employee ID.',notes:'Review the value difference.'}]}}]};
 await page.route(`**/api/workflows/${w.id}`,route=>route.fulfill({json:w}));
 await page.route('**/narration/audio',route=>route.fulfill({status:404,json:{detail:'Fixture has no audio'}}));
 await page.route('**/narration/segments/*/accept',async route=>{
  expect(route.request().postDataJSON().version).toBe(w.version);
  w=structuredClone(w);w.version++;w.narration.segments[0].confirmed=true;
  w.steps[0].narration_details={purpose:'Find the employee record.',expected_result:'Matching records should appear.',validation:'Check the employee ID.',notes:'Review the value difference.'};
  await route.fulfill({json:w});
 });
 await page.goto('/');await page.getByLabel('Session token').fill('browser-test-session-token');await page.getByRole('button',{name:'Connect to workspace'}).click();
 await page.getByLabel('Search workflows').fill(w.title);await page.getByRole('button').filter({has:page.getByRole('heading',{name:w.title})}).click();
 await expect(page.getByText('Mismatch (AI comparison)',{exact:true})).toBeVisible();
 await expect(page.getByText('input: Employee ID | Recorded value: 12354',{exact:true})).toBeVisible();
 await page.getByLabel('Narration 1 transcript').fill('Unsaved narration edit');
 await expect(page.getByRole('button',{name:'Improve all steps',exact:true})).toBeDisabled();
 await expect(page.getByLabel('Narration 1 transcript')).toBeEnabled();
 await page.getByLabel('Narration 1 transcript').fill('Enter employee ID 12345.');
 const accept=page.getByRole('button',{name:'Use reviewed suggestions',exact:true});await expect(accept).toBeDisabled();
 await page.getByLabel('I checked the narration against the captured actions and screenshots, including any differences.').check();
 await accept.click();
 await expect(page.locator('.step-narration-details')).toContainText('Find the employee record.');
 await expect(page.getByLabel('Step 1 instruction',{exact:true})).toHaveValue('Enter "12354" in Employee ID.');
 await page.screenshot({path:'test-results/narration-review.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

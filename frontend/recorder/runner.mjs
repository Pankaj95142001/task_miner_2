import { createInterface } from 'node:readline';
import { ChromiumRecorder } from './engine.mjs';

const lines = createInterface({ input: process.stdin });
let engine;
let work = Promise.resolve();
function status(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
  if (message.phase === 'done' || message.phase === 'error') {
    setTimeout(() => process.exit(message.phase === 'done' ? 0 : 1), 100);
  }
}
function failure() {
  if (engine) {
    engine.phase = 'error';
    if (!engine.error) engine.error = 'The recorder could not continue. Check browser setup and recover saved steps if offered.';
    engine.report();
    void engine.context?.close().catch(() => {});
  } else { status({ type: 'status', phase: 'error', error: 'The recorder configuration could not be read.' }); }
}
lines.on('line', line => {
  let data;
  try { data = JSON.parse(line); } catch { failure(); return; }
  if (!engine) {
    engine = new ChromiumRecorder(data, status);
    work = (data.recover ? engine.recover() : engine.start()).catch(error => {
      engine.error = error.message.includes('Chromium') || error.message.includes('Microsoft Edge') || error.message.includes('Recover') ? error.message : 'The recorder could not connect to the backend.';
      failure();
    });
  } else {
    work = work.then(async () => {
      if (data.action === 'stop') await engine.stop();
      if (data.action === 'pause') await engine.pause();
      if (data.action === 'resume') await engine.resume();
      if (data.action === 'retry') await engine.pump();
    }).catch(failure);
  }
});
lines.on('close', () => { work = work.then(() => engine?.stop()).catch(failure); });
process.on('SIGTERM', () => { work = work.then(() => engine?.stop()).catch(failure); });

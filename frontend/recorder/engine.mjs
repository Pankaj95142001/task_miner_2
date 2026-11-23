import { chromium } from 'playwright';
import { browserChoice } from './browser.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { observePage } from './observer.mjs';
import { attachDownloads } from './downloads.mjs';
import { beforeSnapshot, safeUrl } from '../../extension/core.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const missing = note => ({ note });
const actions = new Set(['click', 'input', 'select', 'navigate', 'tab_switch', 'submit']);
const privateSelectors = ['iframe', '[data-private]', '[data-sop-private]', 'input[type="password"]',
  ...['password', 'secret', 'token', 'card', 'cvv', 'cvc', 'otp', 'ssn'].flatMap(word => [`input[name*="${word}" i]`, `input[id*="${word}" i]`]),
  'input[autocomplete^="cc-"]', 'input[autocomplete="one-time-code"]'].join(',');

export class ChromiumRecorder {
  constructor(config, onStatus = () => {}) {
    this.config = config;
    this.browser = browserChoice(config.browser_channel);
    this.onStatus = onStatus;
    this.phase = 'starting'; this.error = ''; this.downloadError = ''; this.manifest = null;
    this.pages = new Map(); this.jobs = new Map(); this.captures = new Set();
    this.frozen = new Map(); this.nextTab = 1; this.uploading = null; this.finishing = null;
    this.directory = config.directory;
    this.manifestPath = path.join(this.directory, 'session.json');
    this.queuePath = path.join(this.directory, 'queue');
    this.binding = `__sopCapture_${randomUUID().replaceAll('-', '')}`;
    this.excluded = new Set([new URL(config.api).origin, 'http://127.0.0.1:8000', 'http://localhost:8000', 'http://127.0.0.1:5173', 'http://localhost:5173']);
  }

  report() {
    const status = { type: 'status', phase: this.phase, workflow_id: this.manifest?.id || null,
      title: this.manifest?.title || this.config.title || '', count: this.manifest ? this.manifest.nextSequence - 1 : 0,
      pending: this.jobs.size, error: this.error, download_error: this.downloadError };
    this.onStatus(status); return status;
  }

  async api(route, body) {
    const response = await fetch(`${this.config.api}/api${route}`, {
      method: 'POST', headers: { Authorization: `Bearer ${this.config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(typeof data.detail === 'string' ? data.detail : `Backend returned ${response.status}.`);
    }
    return response.json();
  }

  persist(filename, data) {
    fs.writeFileSync(filename + '.tmp', JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(filename + '.tmp', filename);
  }
  saveJob(job) { this.persist(path.join(this.queuePath, `${job.step.id}.json`), job); }

  permitted(page) {
    try { return Boolean(safeUrl(page.url())) && !this.excluded.has(new URL(page.url()).origin); }
    catch { return false; }
  }

  pageState(page) {
    if (!this.pages.has(page)) {
      this.pages.set(page, { id: this.nextTab++, snapshot: null, chain: Promise.resolve(), refreshing: false });
    }
    return this.pages.get(page);
  }

  async start() {
    fs.mkdirSync(this.queuePath, { recursive: true });
    if (fs.existsSync(this.manifestPath)) throw new Error('Recover the previous recording before starting another.');
    this.report();
    try {
      this.context = await chromium.launchPersistentContext(path.join(this.directory, `profile${this.browser.profileSuffix}`), {
        channel: this.browser.channel, headless: Boolean(this.config.headless), chromiumSandbox: true, acceptDownloads: true,
        viewport: this.config.headless ? { width: 1280, height: 900 } : null,
        timeout: 30000,
      });
    } catch {
      if (this.browser.channel === 'msedge') throw new Error('Microsoft Edge could not open. Check that Edge is installed, close another SOP recorder using its profile, and check organization policy.');
      throw new Error('Chromium could not open. Close another SOP recorder using this profile, or run npx.cmd playwright install chromium inside frontend. Organization policy may also restrict it.');
    }
    try {
      this.downloads = attachDownloads(this.context, { directory: this.config.downloadDirectory,
        onError: message => { this.downloadError = message; this.report(); } });
      const workflow = await this.api('/workflows', { title: this.config.title, recording_context: this.config.recording_context || '' });
      this.manifest = { id: workflow.id, title: workflow.title, nextSequence: 1 };
      this.persist(this.manifestPath, this.manifest);
      await this.context.exposeBinding(this.binding, (source, payload) => this.message(source, payload));
      const targetScript = fs.readFileSync(fileURLToPath(new URL('../../extension/targets.js', import.meta.url)), 'utf8');
      await this.context.addInitScript({ content: targetScript + '\n(' + observePage.toString() + ')(' + JSON.stringify({ binding: this.binding, excludedOrigins: [...this.excluded] }) + ');' });
      this.context.on('page', page => this.pageState(page));
      this.context.on('close', () => { if (!this.finishing) void this.stop(); });
      this.phase = 'recording'; this.report();
      this.retryTimer = setInterval(() => { void this.pump(); }, 2500);
      const page = this.context.pages()[0] || await this.context.newPage();
      this.pageState(page);
      await page.goto(this.config.url || 'about:blank', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {
        this.error = 'The starting page did not finish loading. Navigate to your task in the recorder window.';
        this.report();
      });
      return this.report();
    } catch (error) {
      if (this.context) await this.context.close().catch(() => {});
      throw error;
    }
  }

  message({ page, frame }, payload) {
    if (frame !== page.mainFrame() || !this.permitted(page) || !payload || typeof payload !== 'object') return { active: false };
    if (payload.type === 'hello') return { active: this.phase === 'recording' };
    if (this.phase !== 'recording') return { active: false };
    const state = this.pageState(page);
    if (payload.type === 'hint') { void this.refresh(page); return {}; }
    if (payload.type === 'begin_input') {
      if (typeof payload.key === 'string' && payload.key.length < 100) {
        this.frozen.set(`${state.id}:${payload.key}`, state.snapshot);
        while (this.frozen.size > 30) this.frozen.delete(this.frozen.keys().next().value);
      }
      return {};
    }
    if (payload.type === 'event') {
      try { this.enqueue(page, payload.event); }
      catch {
        this.phase = 'paused'; this.error = 'Recording paused because local files could not be written. Check available disk space before continuing.';
        void this.setPageActivity(false); this.report();
      }
    }
    return { active: this.phase === 'recording' };
  }

  enqueue(page, event) {
    if (!event || !actions.has(event.action) || !Number.isFinite(Date.parse(event.occurred_at))) return;
    if (this.jobs.size >= 300) {
      this.phase = 'paused'; this.error = 'Recording paused at 300 pending steps. Retry sync before resuming.';
      void this.setPageActivity(false); this.report(); return;
    }
    const state = this.pageState(page);
    const key = `${state.id}:${event.inputKey}`;
    const shot = event.inputKey ? this.frozen.get(key) : state.snapshot;
    this.frozen.delete(key);
    const truncate = (text, length) => String(text || '').slice(0, length);
    const step = { id: randomUUID(), sequence: this.manifest.nextSequence++, action: event.action,
      occurred_at: new Date(event.occurred_at).toISOString(), tab_id: state.id,
      url: safeUrl(event.url || page.url()), page_title: truncate(event.page_title, 500),
      selector: event.sensitive ? '[private]' : truncate(event.selector, 1000),
      browser_target: event.sensitive ? null : event.browser_target || null,
      label: event.sensitive ? 'the private field' : truncate(event.label, 300),
      sensitive: Boolean(event.sensitive), value: event.sensitive ? '' : truncate(event.value, 2000),
      coordinates: event.action === 'click' ? event.coordinates || null : null,
      before: beforeSnapshot(shot, event, Date.parse(event.occurred_at)),
      after: missing('The recorder closed before the post-action image was captured.') };
    const job = { step, ready: false };
    this.saveJob(job);
    this.jobs.set(step.id, job);
    this.persist(this.manifestPath, this.manifest);
    this.report();
    const task = (async () => {
      await sleep(650);
      step.after = await this.capture(page, 'Post-action view; verify the result when actions happen close together.', Date.now() + 4500);
      if (step.after.data_url) state.snapshot = step.after;
      job.ready = true; this.saveJob(job);
      void this.pump();
    })().catch(() => {
      job.ready = true;
      this.error = 'A screenshot could not be saved. The recorded action is still queued.';
      try { this.saveJob(job); } catch { this.phase = 'paused'; }
      this.report();
    });
    this.captures.add(task);
    void task.finally(() => this.captures.delete(task));
  }

  capture(page, note, deadline = Date.now() + 3500) {
    const state = this.pageState(page);
    const result = state.chain.then(async () => {
      if (this.phase === 'paused' || this.phase === 'pausing') return missing('Recording paused before this image was captured.');
      if (page.isClosed() || !this.permitted(page) || Date.now() > deadline) return missing('The page closed or its screenshot capture window was missed.');
      const address = page.url();
      try {
        if (!(await page.evaluate(() => document.visibilityState === 'visible'))) return missing('This tab was hidden when the screenshot was due.');
        const buffer = await page.screenshot({ type: 'jpeg', quality: 75, scale: 'css', timeout: 2500,
          mask: [page.locator(privateSelectors)], maskColor: '#dce3d8' });
        if (page.url() !== address || !(await page.evaluate(() => document.visibilityState === 'visible'))) return missing('The tab switched or navigated during capture.');
        if (this.phase === 'paused' || this.phase === 'pausing') return missing('Recording paused during capture.');
        return { data_url: `data:image/jpeg;base64,${buffer.toString('base64')}`, captured_at: new Date().toISOString(), url: safeUrl(address), note };
      } catch { return missing('Screenshot unavailable because the page was navigating or closed.'); }
    });
    state.chain = result.catch(() => {}); return result;
  }

  async refresh(page) {
    const state = this.pageState(page);
    if (state.refreshing || Date.now() - Date.parse(state.snapshot?.captured_at || 0) < 1000) return;
    state.refreshing = true;
    try {
      const shot = await this.capture(page, 'Recent pre-action view.');
      if (shot.data_url && this.phase === 'recording') state.snapshot = shot;
    } finally { state.refreshing = false; }
  }

  pump() {
    if (this.uploading) return this.uploading;
    this.uploading = (async () => {
      for (const [id, job] of this.jobs) {
        if (!job.ready) continue;
        try {
          await this.api(`/workflows/${this.manifest.id}/steps`, job.step);
          fs.unlinkSync(path.join(this.queuePath, `${id}.json`));
          this.jobs.delete(id); this.error = ''; this.report();
        } catch {
          this.error = 'Sync pending. Keep the backend running; captured steps are saved locally and will retry.';
          this.report(); break;
        }
      }
    })().finally(() => { this.uploading = null; });
    return this.uploading;
  }

  async setPageActivity(active) {
    await Promise.all((this.context?.pages() || []).map(page => page.evaluate(value => window.__sopRecorderControl?.setActive(value), active).catch(() => {})));
  }
  async flushInputs() {
    await Promise.all((this.context?.pages() || []).map(page => page.evaluate(() => window.__sopRecorderControl?.flush()).catch(() => {})));
  }
  async pause() {
    if (this.phase !== 'recording') return;
    await this.flushInputs(); this.phase = 'paused'; this.frozen.clear();
    for (const state of this.pages.values()) state.snapshot = null;
    await this.setPageActivity(false); this.report();
  }
  async resume() {
    if (this.phase !== 'paused') return;
    if (this.jobs.size >= 300) { await this.pump(); if (this.jobs.size >= 300) return; }
    this.phase = 'recording'; await this.setPageActivity(true); this.report();
  }

  stop() {
    if (this.finishing) return this.finishing;
    this.finishing = (async () => {
      await this.flushInputs(); this.phase = 'stopping'; this.report();
      await this.setPageActivity(false);
      clearInterval(this.retryTimer);
      await Promise.allSettled([...this.captures]);
      await this.downloads?.waitForIdle();
      if (this.context) await this.context.close().catch(() => {});
      await this.uploading;
      await this.pump();
      if (this.jobs.size) {
        this.phase = 'error'; this.error = 'Some steps are saved locally but not synced. Use Recover saved steps when the backend is available.';
      } else if (this.manifest) {
        try {
          await this.api(`/workflows/${this.manifest.id}/stop`);
          fs.unlinkSync(this.manifestPath);
          this.phase = 'done'; this.error = '';
        } catch { this.phase = 'error'; this.error = 'Steps are saved, but the recording could not be finalized. Use Recover saved steps.'; }
      } else { this.phase = 'done'; }
      return this.report();
    })();
    return this.finishing;
  }

  async recover() {
    this.phase = 'recovering';
    this.manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf8'));
    for (const filename of fs.readdirSync(this.queuePath).filter(name => name.endsWith('.json'))) {
      const job = JSON.parse(fs.readFileSync(path.join(this.queuePath, filename), 'utf8'));
      job.ready = true; this.jobs.set(job.step.id, job);
    }
    this.report();
    return this.stop();
  }
}

import { chromium } from 'playwright';
import { browserChoice } from './browser.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachDownloads } from './downloads.mjs';

const project = fileURLToPath(new URL('../../', import.meta.url));

export async function openDashboard({ url = 'http://127.0.0.1:8000',
  profile, directory, headless = false, channel = 'chromium',
  onSaved = filename => console.log(`Saved: ${filename}`), onError = message => console.error(message) } = {}) {
  const browser = browserChoice(channel);
  const profilePath = profile || path.join(project, 'data', `dashboard-profile${browser.profileSuffix}`);
  const context = await chromium.launchPersistentContext(profilePath, {
    channel: browser.channel, chromiumSandbox: true, headless, acceptDownloads: true,
    viewport: headless ? { width: 1440, height: 1050 } : null,
  });
  const downloads = attachDownloads(context, { directory, onSaved, onError });
  const close = async () => { await downloads.waitForIdle(); await context.close(); };
  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return { context, downloads, close };
  } catch (error) {
    await close();
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const choice = browserChoice(process.argv.find(arg => arg.startsWith('--browser='))?.split('=')[1]);
    const browser = await openDashboard({ channel: choice.channel });
    console.log(`SOP Studio downloads: ${browser.downloads.directory}`);
    console.log('Keep this launcher running while using the browser. Close the browser when finished.');
    process.once('SIGINT', () => { void browser.close(); });
    process.once('SIGTERM', () => { void browser.close(); });
    await browser.context.waitForEvent('close', { timeout: 0 });
    await browser.downloads.waitForIdle();
  } catch (error) {
    console.error('Could not open SOP Studio. Keep the backend running, close any existing SOP dashboard using this profile, and check that the selected browser is installed and allowed by your organization.');
    console.error(error.message);
    process.exitCode = 1;
  }
}

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

export function downloadsDirectory() {
  if (process.env.SOP_DOWNLOAD_DIR) return path.resolve(process.env.SOP_DOWNLOAD_DIR);
  if (process.platform === 'win32') {
    try {
      // Respect Downloads folders relocated through Windows (including OneDrive).
      const command = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; " +
        "[Environment]::ExpandEnvironmentVariables((Get-ItemPropertyValue -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders' -Name '{374DE290-123F-4565-9164-39C4925E467B}'))";
      const directory = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command],
        { encoding: 'utf8', windowsHide: true, timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).replace(/^\uFEFF/, '').trim();
      if (path.isAbsolute(directory)) return directory;
    } catch { /* Fall back to the standard user folder if registry access is unavailable. */ }
  }
  return path.join(os.homedir(), 'Downloads');
}

export function safeDownloadName(suggested) {
  let name = String(suggested || '').normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '-').replace(/^[. ]+|[. ]+$/g, '');
  if (!name) name = 'download';
  if (/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name)) name = `_${name}`;
  const extension = path.extname(name).slice(0, 20);
  return path.basename(name, path.extname(name)).slice(0, 140) + extension;
}

// Playwright's download.path() is a temporary UUID file, removed on context close.
// Copy completed downloads outside that directory without ever replacing an existing file.
export function attachDownloads(context, { directory = downloadsDirectory(), onSaved = () => {}, onError = () => {} } = {}) {
  directory = path.resolve(directory);
  const pending = new Set();
  const attached = new WeakSet();
  async function save(download) {
    const name = safeDownloadName(download.suggestedFilename());
    try {
      const source = await download.path();
      if (!source) throw new Error('Download did not produce a file.');
      await fs.promises.mkdir(directory, { recursive: true });
      const extension = path.extname(name);
      const stem = path.basename(name, extension);
      for (let index = 0; ; index++) {
        const target = path.join(directory, index ? `${stem} (${index})${extension}` : name);
        try {
          await fs.promises.copyFile(source, target, fs.constants.COPYFILE_EXCL);
          onSaved(target);
          return target;
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
        }
      }
    } catch {
      onError(`Could not save ${name} to ${directory}. Check folder access and disk space, and keep Chromium open until the download finishes.`);
      return null;
    }
  }
  function attach(page) {
    if (attached.has(page)) return;
    attached.add(page);
    page.on('download', download => {
      const job = save(download);
      pending.add(job);
      void job.finally(() => pending.delete(job));
    });
  }
  context.on('page', attach);
  for (const page of context.pages()) attach(page);
  return { directory, async waitForIdle() { while (pending.size) await Promise.all([...pending]); } };
}

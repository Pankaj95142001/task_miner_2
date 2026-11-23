import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { attachDownloads } from './downloads.mjs';

test('concurrent downloads keep existing files, preserve extensions, and cannot escape Downloads', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sop-download-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'Downloads'); fs.mkdirSync(directory);
  const source = path.join(root, 'temporary-uuid'); fs.writeFileSync(source, '%PDF-new');
  fs.writeFileSync(path.join(directory, 'Report.pdf'), '%PDF-existing');
  const page = new EventEmitter(); const context = new EventEmitter(); context.pages = () => [page];
  const errors = []; const saved = [];
  const downloads = attachDownloads(context, { directory, onSaved: filename => saved.push(filename), onError: error => errors.push(error) });
  for (const name of ['Report.pdf', 'Report.pdf', '../escape.docx', 'CON.pdf']) {
    page.emit('download', { suggestedFilename: () => name, path: async () => source });
  }
  await downloads.waitForIdle();
  assert.equal(fs.readFileSync(path.join(directory, 'Report.pdf'), 'utf8'), '%PDF-existing');
  assert.deepEqual(saved.map(filename => path.basename(filename)).sort(), ['Report (1).pdf', 'Report (2).pdf', '-escape.docx', '_CON.pdf'].sort());
  for (const filename of saved) {
    assert.equal(path.dirname(filename), directory);
    assert.equal(fs.readFileSync(filename, 'utf8'), '%PDF-new');
  }
  assert.deepEqual(errors, []);
});

test('failed downloads report an error without creating a success file', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sop-download-failure-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const page = new EventEmitter(); const context = new EventEmitter(); context.pages = () => [];
  const errors = []; const saved = [];
  const downloads = attachDownloads(context, { directory: root, onSaved: filename => saved.push(filename), onError: error => errors.push(error) });
  context.emit('page', page);
  page.emit('download', { suggestedFilename: () => 'Failed.pdf', path: async () => { throw new Error('canceled'); } });
  await downloads.waitForIdle();
  assert.deepEqual(saved, []);
  assert.deepEqual(fs.readdirSync(root), []);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Could not save Failed.pdf/);
});

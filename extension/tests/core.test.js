import test from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl, eligible, beforeSnapshot, validateConfig } from '../core.js';

test('URL metadata removes credentials, queries, and fragments', () => {
  assert.equal(safeUrl('https://user:secret@example.org/task?token=secret#private'), 'https://example.org/task');
  assert.equal(safeUrl('chrome://settings'), '');
  assert.equal(safeUrl('not a url'), '');
});
test('record normal tabs but exclude private tabs and the dashboard', () => {
  assert.equal(eligible({ url: 'https://example.org', incognito: false }), true);
  assert.equal(eligible({ url: 'https://example.org', incognito: true }), false);
  assert.equal(eligible({ url: 'http://127.0.0.1:8000' }, { api: 'http://127.0.0.1:8000' }), false);
});
test('before image must predate the action and belong to its page', () => {
  const now = Date.now();
  const shot = { data_url: 'image', captured_at: new Date(now - 1000).toISOString(), url: 'https://example.org/a' };
  const event = { action: 'click', occurred_at: new Date(now).toISOString(), url: shot.url };
  assert.equal(beforeSnapshot(shot, event, now).data_url, 'image');
  assert.equal(beforeSnapshot({ ...shot, captured_at: new Date(now + 1000).toISOString() }, event, now).data_url, undefined);
  assert.equal(beforeSnapshot({ ...shot, url: 'https://example.org/b' }, event, now).data_url, undefined);
  assert.equal(beforeSnapshot({ ...shot, captured_at: new Date(now - 46000).toISOString() }, event, now).data_url, undefined);
  assert.equal(beforeSnapshot({ ...shot, url: 'https://example.org/b' }, { ...event, action: 'navigate' }, now).data_url, 'image');
});
test('local credentials cannot be sent to a remote backend URL', () => {
  const cfg = { api: 'http://127.0.0.1:8000/', dashboard: 'http://localhost:5173', token: 'a-test-session-token' };
  assert.equal(validateConfig(cfg).api, 'http://127.0.0.1:8000');
  assert.throws(() => validateConfig({ ...cfg, api: 'https://example.org' }));
  assert.throws(() => validateConfig({ ...cfg, api: 'http://user:password@localhost:8000' }));
});

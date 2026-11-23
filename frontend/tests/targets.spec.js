import { test, expect } from '@playwright/test';
import path from 'node:path';

test('captured selectors survive layout changes and reject ambiguous or private targets', async ({ page }) => {
  await page.goto('/');
  await page.setContent(`<main><div><button data-testid="save">Save</button></div>
    <button id="duplicate">First</button><button id="duplicate" aria-label="Second">Second</button>
    <a href="https://example.org/task?token=secret-value">Task</a>
    <input id="password" type="password" value="private-value"></main>`);
  await page.addScriptTag({ path: path.resolve('../extension/targets.js') });
  const results = await page.evaluate(() => {
    const capture = globalThis.__sopCaptureTarget;
    const el = document.querySelector('[data-testid]'); const target = capture(el);
    const unique = target.candidates.every(c => document.querySelectorAll(c.selector).length === 1 && document.querySelector(c.selector) === el);
    document.body.prepend(document.createElement('aside')); document.body.append(el);
    return { target, unique, stillMatches: document.querySelector(target.candidates[0].selector) === el,
      duplicate: capture(document.querySelector('[aria-label]')), link: capture(document.querySelector('a')),
      privateTarget: capture(document.querySelector('input')) };
  });
  expect(results.unique).toBeTruthy(); expect(results.stillMatches).toBeTruthy();
  expect(results.target.candidates[0].strategy).toBe('testid');
  expect(results.duplicate.candidates.some(c => c.selector === '#duplicate')).toBeFalsy();
  expect(results.duplicate.candidates[0].strategy).toBe('attribute');
  expect(JSON.stringify(results.link)).not.toContain('secret-value');
  expect(results.privateTarget).toBeNull();
});

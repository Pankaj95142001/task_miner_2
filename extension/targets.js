// Shared by the extension and the dedicated Playwright recorder.
(() => {
  globalThis.__sopCaptureTarget = function captureTarget(el) {
    if (!(el instanceof Element) || el.getRootNode() !== document) return null;
    if (el.closest('[data-private],[data-sop-private]') || el.type === 'password' ||
        /password|secret|token|credit.?card|card.?number|cvv|cvc|otp|ssn|cc-|one-time-code/i.test([el.name, el.id, el.autocomplete].join(' '))) return null;
    const candidates = [];
    const tag = el.tagName.toLowerCase();
    const add = (selector, strategy) => {
      if (!selector || selector.length > 1000 || candidates.length >= 8 || candidates.some(c => c.selector === selector)) return;
      try {
        const matches = document.querySelectorAll(selector);
        if (matches.length === 1 && matches[0] === el) candidates.push({ selector, strategy });
      } catch { /* Unsupported or malformed selectors are never retained. */ }
    };
    const attr = (node, name) => {
      const value = node.getAttribute(name);
      return value && value.length <= 200 ? `[${name}="${CSS.escape(value)}"]` : '';
    };
    for (const name of ['data-testid', 'data-test', 'data-qa']) {
      if (attr(el, name)) add(tag + attr(el, name), 'testid');
    }
    if (el.id && !/^[0-9]|[a-f0-9]{16,}|\d{8,}/i.test(el.id)) add('#' + CSS.escape(el.id), 'id');
    for (const name of ['aria-label', 'name', 'placeholder', 'title', 'alt']) {
      if (attr(el, name)) add(tag + attr(el, name), 'attribute');
    }
    if (tag === 'a' && el.hasAttribute('href')) {
      try {
        const raw = el.getAttribute('href');
        const href = new URL(raw, location.href);
        if (/^https?:$/.test(href.protocol) && !href.username && !href.password) {
          // Do not include query tokens or fragments in locator metadata.
          const clean = raw.split(/[?#]/)[0];
          if (clean && clean.length <= 400) add(`a[href${href.search || href.hash ? '^' : ''}="${CSS.escape(clean)}"]`, 'href');
        }
      } catch { /* Non-web links remain available via other candidates. */ }
    }
    const path = [];
    for (let node = el; node && path.length < 20; node = node.parentElement) {
      if (node !== el && node.id) {
        add('#' + CSS.escape(node.id) + ' > ' + path.join(' > '), 'structure');
      }
      const index = node.parentElement ? [...node.parentElement.children].indexOf(node) + 1 : 1;
      path.unshift(node.tagName.toLowerCase() + `:nth-child(${index})`);
      if (node === document.documentElement) add(path.join(' > '), 'structure');
    }
    const box = el.getBoundingClientRect();
    const implicit = { BUTTON:'button', A:el.hasAttribute('href') ? 'link' : '', INPUT:({checkbox:'checkbox',radio:'radio',button:'button',submit:'button',reset:'button',range:'slider',number:'spinbutton',search:'searchbox'}[el.type] || 'textbox'), TEXTAREA:'textbox', SELECT:'combobox' };
    return { tag, role: (el.getAttribute('role') || implicit[el.tagName] || '').slice(0, 50),
      name: (el.getAttribute('aria-label') || el.labels?.[0]?.textContent || el.title || el.placeholder || el.innerText || el.name || tag).trim().replace(/\s+/g, ' ').slice(0, 180),
      candidates, rect: { x: box.x, y: box.y, width: box.width, height: box.height },
      viewport_width: innerWidth, viewport_height: innerHeight };
  };
})();

(() => {
  if (globalThis.__sopRecorder) return;
  globalThis.__sopRecorder = true;
  let active = false;
  let currentUrl = location.href;
  let pendingInput = null;
  let inputTimer;
  let hintTimer;
  let maskHost;
  let maskTimer;
  const committedValues = new WeakMap();
  let pendingElement;

  function send(message) {
    try { return chrome.runtime.sendMessage(message).then(result => result?.data).catch(() => null); }
    catch { active = false; return Promise.resolve(null); }
  }
  function safeUrl() { return `${location.origin}${location.pathname}`; }
  function isSensitive(element) {
    return !!element.closest('[data-private], [data-sop-private]') || element.type === 'password' || /password|secret|token|credit.?card|card.?number|cvv|cvc|otp|ssn/i.test([element.name, element.id, element.autocomplete].join(' ')) || /^(cc-|one-time-code)/i.test(element.autocomplete || '');
  }
  function label(element) {
    if (isSensitive(element)) return 'the private field';
    return (element.getAttribute('aria-label') || element.labels?.[0]?.textContent || element.getAttribute('title') || element.getAttribute('placeholder') || element.innerText || element.getAttribute('alt') || element.name || element.tagName.toLowerCase()).trim().replace(/\s+/g, ' ').slice(0, 180);
  }
  function selector(element) {
    return isSensitive(element) ? '[private]' : globalThis.__sopCaptureTarget?.(element)?.candidates[0]?.selector || '';
  }
  function eventData(action, element, extra = {}) {
    const privateField = Boolean(element && isSensitive(element));
    const target = element && !privateField ? globalThis.__sopCaptureTarget?.(element) || null : null;
    return { action, occurred_at: new Date().toISOString(), url: safeUrl(), page_title: document.title.slice(0, 500),
      label: element ? label(element) : document.title.slice(0, 300), sensitive: privateField,
      selector: privateField ? '[private]' : target?.candidates[0]?.selector || '', browser_target: target, ...extra };
  }
  function hint() {
    if (!active || document.visibilityState !== 'visible') return;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => send({ type: 'SNAPSHOT_HINT' }), 180);
  }
  function clickCoordinates(event) {
    if (event.detail === 0) return null;
    return { x: event.clientX, y: event.clientY, page_x: event.pageX, page_y: event.pageY,
      scroll_x: window.scrollX, scroll_y: window.scrollY,
      viewport_width: window.innerWidth, viewport_height: window.innerHeight,
      device_pixel_ratio: window.devicePixelRatio };
  }
  function flushInput() {
    clearTimeout(inputTimer);
    if (!pendingInput) return Promise.resolve();
    const input = pendingInput; pendingInput = null;
    if (pendingElement) committedValues.set(pendingElement, input.value);
    pendingElement = null;
    return send({ type: 'EVENT', event: input });
  }
  function inputChanged(event) {
    if (!active || !event.isTrusted) return;
    const el = event.target;
    if (!(el instanceof Element) || !el.matches('input,textarea,select,[contenteditable="true"]')) return;
    if (['button', 'submit', 'reset', 'file', 'hidden'].includes(el.type)) return;
    const value = el.matches('[contenteditable="true"]') ? el.textContent : ['checkbox', 'radio'].includes(el.type) ? (el.checked ? 'checked' : 'unchecked') : el.tagName === 'SELECT' ? el.selectedOptions[0]?.textContent : el.value;
    const normalized = isSensitive(el) ? '' : String(value || '').slice(0, 2000);
    if (!pendingInput && committedValues.get(el) === normalized && !isSensitive(el)) return;
    const sel = selector(el);
    if (pendingInput && pendingInput.selector !== sel) void flushInput();
    if (!pendingInput) {
      const key = crypto.randomUUID();
      send({ type: 'BEGIN_INPUT', key });
      pendingInput = eventData(el.tagName === 'SELECT' ? 'select' : 'input', el, { inputKey: key, sensitive: isSensitive(el) });
      pendingElement = el;
    }
    pendingInput.value = normalized;
    clearTimeout(inputTimer);
    inputTimer = setTimeout(flushInput, 800);
  }

  document.addEventListener('input', inputChanged, true);
  document.addEventListener('change', event => { inputChanged(event); if (event.target.matches('select,input[type="checkbox"],input[type="radio"]')) void flushInput(); }, true);
  document.addEventListener('focusout', () => { void flushInput(); }, true);
  document.addEventListener('click', event => {
    if (!active || !event.isTrusted || !(event.target instanceof Element)) return;
    void flushInput();
    const el = event.target.closest('a,button,input,[role="button"],[role="link"],summary,label') || event.target;
    if (el.closest('[data-sop-overlay]') || el.matches('input,textarea,select,label') || el.isContentEditable) return;
    send({ type: 'EVENT', event: eventData('click', el, { coordinates: clickCoordinates(event) }) });
  }, true);
  document.addEventListener('submit', event => {
    if (!active || !event.isTrusted) return;
    void flushInput();
    // A submit-button click is already a step; capture keyboard submissions only.
    if (!event.submitter || document.activeElement?.matches('input,textarea')) send({ type: 'EVENT', event: eventData('submit', event.target) });
  }, true);
  document.addEventListener('pointerover', event => { if (event.target instanceof Element && event.target.closest('a,button,input,select,textarea,[role="button"]')) hint(); }, true);
  document.addEventListener('focusin', hint, true);
  document.addEventListener('scroll', hint, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) void flushInput(); else hint(); });
  window.addEventListener('pagehide', () => { void flushInput(); });
  window.addEventListener('popstate', checkNavigation);
  window.addEventListener('hashchange', checkNavigation);
  function checkNavigation() {
    if (currentUrl === location.href) return;
    void flushInput(); currentUrl = location.href;
    if (active && !document.hidden) send({ type: 'EVENT', event: eventData('navigate') });
  }
  setInterval(checkNavigation, 600);

  function clearMask() { clearTimeout(maskTimer); maskHost?.remove(); maskHost = null; }
  async function prepareScreenshot() {
    if (document.hidden) return { ready: false };
    clearMask();
    maskHost = document.createElement('div');
    maskHost.dataset.sopOverlay = 'true';
    maskHost.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
    const root = maskHost.attachShadow({ mode: 'closed' });
    for (const el of document.querySelectorAll('input,textarea,[contenteditable="true"],[data-private],[data-sop-private],iframe')) {
      // Cross-origin frames cannot be inspected safely, so mask every frame in this MVP.
      if (el.tagName !== 'IFRAME' && !isSensitive(el)) continue;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const cover = document.createElement('div');
      cover.style.cssText = `position:absolute;left:${Math.max(0, rect.left - 2)}px;top:${Math.max(0, rect.top - 2)}px;width:${rect.width + 4}px;height:${rect.height + 4}px;background:#dce3d8;border:1px solid #bccab4;border-radius:4px;color:#587249;font:11px system-ui;display:flex;align-items:center;justify-content:center;overflow:hidden`;
      cover.textContent = el.tagName === 'IFRAME' ? 'Embedded content' : 'Private field';
      root.appendChild(cover);
    }
    document.documentElement.appendChild(maskHost);
    maskTimer = setTimeout(clearMask, 2500);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { ready: true };
  }
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type === 'STATE') { active = message.state.active; if (active) hint(); respond({ ok: true }); }
    if (message.type === 'FLUSH_INPUTS') { flushInput().then(() => respond({ ok: true })); return true; }
    if (message.type === 'PREPARE_SCREENSHOT') { prepareScreenshot().then(respond); return true; }
    if (message.type === 'FINISH_SCREENSHOT') { clearMask(); respond({ ok: true }); }
  });
  function initialize() {
    send({ type: 'GET_STATE' }).then(state => {
      active = Boolean(state?.active);
      if (active && !document.hidden) send({ type: 'EVENT', event: eventData('navigate') });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true }); else initialize();
})();

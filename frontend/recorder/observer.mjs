// This function is installed into pages in the dedicated recorder browser only.
export function observePage({ binding, excludedOrigins }) {
  if (window !== window.top || !/^https?:$/.test(location.protocol) || excludedOrigins.includes(location.origin)) return;
  let active = false;
  let pending = null;
  let pendingElement = null;
  let timer;
  let lastHint = 0;
  let previousUrl = location.href;
  const committed = new WeakMap();
  const send = payload => window[binding](payload).catch(() => null);
  const url = () => `${location.origin}${location.pathname}`;
  const sensitive = el => !!el.closest('[data-private],[data-sop-private]') || el.type === 'password' || /password|secret|token|credit.?card|card.?number|cvv|cvc|otp|ssn|cc-|one-time-code/i.test([el.name, el.id, el.autocomplete].join(' '));
  function label(el) {
    if (sensitive(el)) return 'the private field';
    return (el.getAttribute('aria-label') || el.labels?.[0]?.textContent || el.title || el.placeholder || el.innerText || el.name || el.tagName.toLowerCase()).trim().replace(/\s+/g, ' ').slice(0, 180);
  }
  function details(action, el, extra = {}) {
    const privateField = Boolean(el && sensitive(el));
    const target = el && !privateField ? window.__sopCaptureTarget?.(el) || null : null;
    return { action, occurred_at: new Date().toISOString(), url: url(), page_title: document.title.slice(0, 500),
      label: el ? label(el) : document.title.slice(0, 300), sensitive: privateField,
      selector: privateField ? '[private]' : target?.candidates[0]?.selector || '', browser_target: target, ...extra };
  }
  function emit(event) { return send({ type: 'event', event }); }
  function clickCoordinates(event) {
    // Keyboard/accessibility activation has no pointer location (detail is zero).
    if (event.detail === 0) return null;
    return { x: event.clientX, y: event.clientY, page_x: event.pageX, page_y: event.pageY,
      scroll_x: window.scrollX, scroll_y: window.scrollY,
      viewport_width: window.innerWidth, viewport_height: window.innerHeight,
      device_pixel_ratio: window.devicePixelRatio };
  }
  function hint() {
    if (!active || document.hidden || Date.now() - lastHint < 1000) return;
    lastHint = Date.now(); void send({ type: 'hint' });
  }
  function flush() {
    clearTimeout(timer);
    if (!pending) return Promise.resolve();
    const event = pending; pending = null;
    if (pendingElement) committed.set(pendingElement, event.value);
    pendingElement = null;
    return emit(event);
  }
  function input(event) {
    if (!active || !event.isTrusted) return;
    const el = event.target;
    if (!(el instanceof Element) || !el.matches('input,textarea,select,[contenteditable="true"]') || ['button', 'submit', 'reset', 'file', 'hidden'].includes(el.type)) return;
    const value = el.isContentEditable ? el.textContent : ['checkbox', 'radio'].includes(el.type) ? (el.checked ? 'checked' : 'unchecked') : el.tagName === 'SELECT' ? el.selectedOptions[0]?.textContent : el.value;
    const normalized = sensitive(el) ? '' : String(value || '').slice(0, 2000);
    if (pending && el !== pendingElement) void flush();
    if (!pending && !sensitive(el) && committed.get(el) === normalized) return;
    if (!pending) {
      const key = crypto.randomUUID();
      void send({ type: 'begin_input', key });
      pending = details(el.tagName === 'SELECT' ? 'select' : 'input', el, { inputKey: key, sensitive: sensitive(el) });
      pendingElement = el;
    }
    pending.value = normalized;
    clearTimeout(timer); timer = setTimeout(flush, 800);
  }
  document.addEventListener('input', input, true);
  document.addEventListener('change', event => { input(event); if (event.target.matches('select,input[type="checkbox"],input[type="radio"]')) void flush(); }, true);
  document.addEventListener('focusout', () => { void flush(); }, true);
  document.addEventListener('click', event => {
    if (!active || !event.isTrusted || !(event.target instanceof Element)) return;
    void flush();
    const el = event.target.closest('a,button,input,[role="button"],[role="link"],summary,label') || event.target;
    if (el.matches('input,textarea,select,label') || el.isContentEditable) return;
    void emit(details('click', el, { coordinates: clickCoordinates(event) }));
  }, true);
  document.addEventListener('submit', event => {
    if (!active || !event.isTrusted) return;
    void flush();
    if (!event.submitter || document.activeElement?.matches('input,textarea')) void emit(details('submit', event.target));
  }, true);
  document.addEventListener('pointerover', event => { if (event.target instanceof Element && event.target.closest('a,button,input,textarea,select,[role="button"]')) hint(); }, true);
  document.addEventListener('focusin', hint, true);
  document.addEventListener('scroll', hint, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void flush();
    else if (active) { void emit(details('tab_switch')); hint(); }
  });
  window.addEventListener('pagehide', () => { void flush(); });
  setInterval(() => {
    if (location.href === previousUrl) return;
    void flush(); previousUrl = location.href;
    if (active && !document.hidden) void emit(details('navigate'));
  }, 500);
  window.__sopRecorderControl = {
    flush,
    setActive(value) {
      active = value;
      if (!active) { clearTimeout(timer); pending = null; pendingElement = null; }
      else hint();
    },
  };
  async function initialize() {
    const state = await send({ type: 'hello' });
    active = Boolean(state?.active);
    if (active && !document.hidden) await emit(details('navigate'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else void initialize();
}

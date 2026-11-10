import { blackFridayView, jsonLdText } from './view.js?v=20261110-continuous-grid';
import { animate } from '/assets/site-ui.js';

const main = document.querySelector('[data-bf-offer]');
const offerId = main?.dataset.bfOffer || '';
let timer, expiryTimer, loading = false, lastContent, expiry, currentEvent;

function initializeEventBands(root) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let animation;
  const stop = () => { animation?.revert(); animation = null; };
  function highlight(event) {
    const link = event.target.closest('[data-bf-jump]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const heading = document.getElementById(link.hash.slice(1))?.querySelector('h2');
    if (!heading) return;
    stop();
    if (!motion.matches) animation = animate(heading, { translateY: [5, 0], opacity: [.76, 1], duration: 230, ease: 'out(3)' });
  }
  root.addEventListener('click', highlight);
  motion.addEventListener('change', stop);
  addEventListener('pagehide', function clean(event) {
    stop();
    if (event.persisted) return;
    root.removeEventListener('click', highlight);
    motion.removeEventListener('change', stop);
    removeEventListener('pagehide', clean);
  });
}

function render(event) {
  const view = blackFridayView(event, offerId);
  document.title = view.title;
  document.querySelector('meta[name="description"]').content = view.description;
  document.querySelector('meta[name="robots"]').content = !offerId || view.status === 200 ? 'index,follow' : 'noindex,follow';
  let schema = document.getElementById('bf-json-ld');
  if (view.schema) {
    if (!schema) {
      schema = document.createElement('script');
      schema.type = 'application/ld+json';
      schema.id = 'bf-json-ld';
      document.head.append(schema);
    }
    schema.textContent = jsonLdText(view.schema);
  } else schema?.remove();
  if (view.content !== lastContent) {
    const focus = document.activeElement?.dataset.bfFocus;
    main.innerHTML = view.content;
    if (focus) {
      const replacement = [...main.querySelectorAll('[data-bf-focus]')].find(node => node.dataset.bfFocus === focus);
      if (replacement) replacement.focus({ preventScroll: true });
      else {
        const title = main.querySelector('h1');
        title.tabIndex = -1;
        title.focus({ preventScroll: true });
      }
    }
    lastContent = view.content;
  }
}

function expire() {
  if (!expiry || Date.now() < expiry) return;
  expiry = 0;
  render({ ...currentEvent, state: 'closed', items: [] });
}

function trackExpiry(event) {
  clearTimeout(expiryTimer);
  currentEvent = event;
  expiry = 0;
  const remaining = Date.parse(event.endsAt) - Date.parse(event.serverTime);
  if (event.state !== 'open' || !Number.isFinite(remaining)) return;
  expiry = Date.now() + remaining;
  if (remaining <= 0) expire();
  else expiryTimer = setTimeout(() => { expire(); refresh(); }, Math.min(remaining + 25, 2_147_483_647));
}

async function refresh() {
  expire();
  if (loading) return;
  loading = true;
  clearTimeout(timer);
  let delay = 30_000;
  try {
    const response = await fetch('/api/black-friday', { cache: 'no-store' });
    if (!response.ok) throw new Error('Unavailable');
    const event = await response.json();
    render(event);
    trackExpiry(event);
    const boundary = event.state === 'scheduled' ? event.startsAt : event.state === 'open' ? event.endsAt : null;
    if (boundary) delay = Math.max(250, Math.min(delay, Date.parse(boundary) - Date.parse(event.serverTime) + 100));
  } catch {
    trackExpiry({ state: 'error' });
    render({ state: 'error' });
  } finally {
    loading = false;
    timer = setTimeout(refresh, delay);
  }
}

if (main?.dataset.bfEnds) trackExpiry({ state: 'open', startsAt: main.dataset.bfStarts, endsAt: main.dataset.bfEnds, serverTime: main.dataset.bfTime });
if (main) {
  initializeEventBands(main);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
  refresh();
}

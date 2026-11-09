import { blackFridayView, jsonLdText } from './view.js';

const main = document.querySelector('[data-bf-offer]');
const offerId = main?.dataset.bfOffer || '';
let timer, expiryTimer, loading = false, lastContent, expiry, currentEvent;

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
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
  refresh();
}

import { visitorDay, visitorPage, VISITOR_PRODUCT_PAGES } from './visitor-pages.js';

const VISIT_DATE_KEY = 'himawari-visitor-day';

function markToday(day) {
  try {
    if (localStorage.getItem(VISIT_DATE_KEY) === day) return false;
    localStorage.setItem(VISIT_DATE_KEY, day);
    return true;
  } catch {
    return false;
  }
}

async function sendView(page, productId) {
  const day = visitorDay();
  const newVisitor = navigator.locks
    ? await navigator.locks.request(VISIT_DATE_KEY, () => markToday(day)).catch(() => markToday(day))
    : markToday(day);
  try {
    const response = await fetch('/api/visitor-view', {
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, productId, newVisitor }),
    });
    if (response.ok) return;
  } catch { /* The storefront still works if the statistics request fails. */ }
  if (newVisitor) {
    try {
      if (localStorage.getItem(VISIT_DATE_KEY) === day) localStorage.removeItem(VISIT_DATE_KEY);
    } catch { /* Storage may become unavailable during navigation. */ }
  }
}

export function startVisitorCounter() {
  const page = visitorPage(window.location.pathname);
  if (!page) return;

  function record() {
    if (document.visibilityState !== 'visible') {
      document.addEventListener('visibilitychange', record, { once: true });
      return;
    }
    const productId = VISITOR_PRODUCT_PAGES.has(page)
      ? document.querySelector('[data-detail-cart][data-product-id]')?.dataset.productId
      : '';
    if (productId === undefined) return;
    void sendView(page, productId);
  }

  record();
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) record();
  });
}

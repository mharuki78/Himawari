const offerPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export function blackFridayDetailPath(offerId) {
  return typeof offerId === 'string' && offerPattern.test(offerId) ? `/black-friday/item/${offerId.toLowerCase()}/` : '';
}

export function blackFridayOfferFromPath(pathname) {
  const match = String(pathname || '').match(/^\/black-friday\/item\/([^/]+)\/?$/);
  return match && blackFridayDetailPath(match[1]) ? match[1].toLowerCase() : '';
}

export function resolveBlackFridayDetail(event, offerId, products, expectedPrice = null) {
  const unavailable = () => { throw new Error('행사가 끝났거나 가격 또는 남은 수량이 바뀌었습니다. 블랙 프라이데이에서 다시 확인해 주세요.'); };
  if (!blackFridayDetailPath(offerId) || event?.state !== 'open' || !Number.isFinite(Date.parse(event.endsAt)) ||
    (event.serverTime && Date.parse(event.serverTime) >= Date.parse(event.endsAt))) return unavailable();
  const offer = event.items?.find(item => item.offerId?.toLowerCase() === offerId.toLowerCase());
  const original = products.find(item => item.id === offer?.productId);
  if (!original || !Number.isSafeInteger(offer.price) || offer.price < 1 || offer.price >= original.price ||
    (expectedPrice !== null && Number(expectedPrice) !== offer.price) || !Number.isSafeInteger(offer.remaining) || offer.remaining < 0) return unavailable();
  const options = Array.isArray(original.options) ? original.options : [];
  const option = options.find(item => item.id === offer.optionId);
  if (options.length ? !option : Boolean(offer.optionId)) return unavailable();
  const stock = Math.max(0, Math.min(offer.remaining, (option ? option.stock : original.stock) ?? Infinity));
  const product = { ...original, price: offer.price, stock, soldOut: original.soldOut || stock === 0,
    options: option ? [{ ...option, stock }] : [] };
  return { product, offer, endsAt: event.endsAt, serverTime: event.serverTime };
}

export function refreshBlackFridayProductSchema(schema, { product, offer, endsAt }, origin) {
  const canonical = origin + blackFridayDetailPath(offer.offerId);
  return { ...schema, '@id': `${canonical}#product`, url: canonical,
    offers: { ...schema.offers, url: canonical, price: offer.price,
      availability: product.soldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      validThrough: endsAt,
      priceValidUntil: new Date(Date.parse(endsAt) - 1 + 9 * 3600_000).toISOString().slice(0, 10) } };
}

export function createBlackFridayDetailLifecycle({ context, refresh, onBlock, onUpdate,
  document: doc = globalThis.document, window: win = globalThis.window,
  now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout }) {
  let expiryTimer, refreshTimer, deadline = 0, pending = null, disposed = false, revision = 0;
  const clearTimers = () => { clearTimer(expiryTimer); clearTimer(refreshTimer); };
  const track = value => {
    clearTimer(expiryTimer);
    const remaining = Date.parse(value.endsAt) - Date.parse(value.serverTime);
    if (!Number.isFinite(remaining) || remaining <= 0) {
      deadline = 0;
      onBlock('블랙 프라이데이 행사가 종료됐습니다.');
      return false;
    }
    deadline = now() + remaining;
    const check = () => {
      if (disposed) return;
      if (now() >= deadline) { deadline = 0; onBlock('블랙 프라이데이 행사가 종료됐습니다.'); }
      else expiryTimer = setTimer(check, Math.min(deadline - now(), 2_147_483_647));
    };
    expiryTimer = setTimer(check, Math.min(remaining, 2_147_483_647));
    return true;
  };
  const scheduleRefresh = () => {
    clearTimer(refreshTimer);
    if (!disposed) refreshTimer = setTimer(revalidate, 30_000);
  };
  async function revalidate() {
    if (disposed) return;
    if (pending) return pending;
    clearTimers();
    onBlock('행사 가격과 남은 수량을 다시 확인하고 있습니다.');
    const requestRevision = ++revision;
    pending = (async () => {
      try {
        const next = await refresh();
        if (!disposed && requestRevision === revision && track(next)) onUpdate(next);
      } catch (error) {
        if (!disposed && requestRevision === revision) onBlock(error.message || '행사 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.');
      } finally {
        if (requestRevision === revision) { pending = null; scheduleRefresh(); }
      }
    })();
    return pending;
  }
  const visibility = () => { if (!doc.hidden) return revalidate(); };
  const pageshow = event => { if (event.persisted) return revalidate(); };
  const pagehide = event => {
    clearTimers();
    revision++;
    pending = null;
    if (event.persisted) onBlock('행사 가격과 남은 수량을 다시 확인하고 있습니다.');
    else dispose();
  };
  function dispose() {
    disposed = true;
    revision++;
    clearTimers();
    doc.removeEventListener('visibilitychange', visibility);
    win.removeEventListener('pageshow', pageshow);
    win.removeEventListener('pagehide', pagehide);
  }
  doc.addEventListener('visibilitychange', visibility);
  win.addEventListener('pageshow', pageshow);
  win.addEventListener('pagehide', pagehide);
  track(context);
  scheduleRefresh();
  return { revalidate, dispose };
}

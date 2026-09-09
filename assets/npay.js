let initialized = false;
let currentCartItems = [];
let config = null;
let sdkPromise = null;
let sdkBlockedMessage = '';
const pending = new Map();

function revealProductNpay(section) {
  section.hidden = false;
  document.querySelector('[data-sticky-npay]')?.removeAttribute('hidden');
}

function setStatus(section, message, isError = false) {
  const status = section?.querySelector('[data-npay-status]');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

function buttonErrorMessage(error) {
  if (/origin verification failed/i.test(String(error?.message || ''))) {
    sdkBlockedMessage = '네이버페이 Sandbox에 검수 도메인을 확인하고 있습니다.';
    return sdkBlockedMessage;
  }
  return '네이버페이 버튼을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || '네이버페이 요청을 완료하지 못했습니다.');
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function loadSdk(url) {
  if (window.Npay?.order?.create) return Promise.resolve(window.Npay);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.addEventListener('load', () => {
      if (window.Npay?.order?.create) resolve(window.Npay);
      else reject(new Error('네이버페이 버튼을 준비하지 못했습니다.'));
    }, { once: true });
    script.addEventListener('error', () => reject(new Error('네이버페이 버튼을 불러오지 못했습니다.')), { once: true });
    document.head.append(script);
  });
  return sdkPromise;
}

function runOnce(key, work) {
  if (pending.has(key)) return pending.get(key);
  const promise = work().finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}

async function registerOrder(items, context, section) {
  window.himawariTrack?.('Begin checkout', { destination: 'npay', context, itemCount: items.length });
  setStatus(section, '네이버페이 주문서를 준비하고 있습니다.');
  try {
    const result = await runOnce(`order:${context}`, () => requestJson('/api/npay/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, context }),
    }));
    setStatus(section, '네이버페이 주문서로 이동합니다.');
    return { key: result.key, merchantNo: result.merchantNo };
  } catch (error) {
    setStatus(section, error.message || '네이버페이 주문서를 열지 못했습니다.', true);
    return null;
  }
}

async function registerWishlist(productId, section) {
  window.himawariTrack?.('Npay wishlist', { productId });
  setStatus(section, '네이버 찜 목록에 저장하고 있습니다.');
  try {
    const result = await runOnce(`wishlist:${productId}`, () => requestJson('/api/npay/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    }));
    setStatus(section, '네이버 찜 목록으로 이동합니다.');
    return { merchantId: result.merchantId, payProductId: result.payProductId };
  } catch (error) {
    setStatus(section, error.message || '네이버 찜 목록에 저장하지 못했습니다.', true);
    return null;
  }
}

async function createProductButton() {
  const section = document.querySelector('[data-npay-product-section]');
  const container = section?.querySelector('[data-npay-product]');
  if (!section || !container || !config || !window.Npay?.order?.create || container.dataset.npayReady === 'true') return;
  if (sdkBlockedMessage) {
    revealProductNpay(section);
    setStatus(section, sdkBlockedMessage, true);
    return;
  }
  const productId = container.dataset.productId || new URLSearchParams(location.search).get('id');
  if (!productId) return;

  revealProductNpay(section);
  container.dataset.npayReady = 'true';
  try {
    await window.Npay.order.create({
      buttonKey: config.buttonKey,
      containerId: container.id,
      orderRegistrationVersion: '2.1',
      type: 'template',
      colorTheme: 'green',
      enable: container.dataset.soldOut !== 'true',
      components: {
        wishlist: true,
        talkTalk: false,
        benefitMessage: true,
        benefitCoachMark: true,
      },
      onBuyClick: () => {
        const optionId = container.dataset.optionId || '';
        if (container.dataset.hasOptions === 'true' && !optionId) {
          setStatus(section, '주문할 옵션을 먼저 선택해 주세요.', true);
          document.querySelector('[data-product-option]')?.focus();
          return false;
        }
        return registerOrder([{ productId, optionId, quantity: 1 }], 'product', section);
      },
      onWishlistClick: () => registerWishlist(productId, section),
    });
  } catch (error) {
    delete container.dataset.npayReady;
    setStatus(section, buttonErrorMessage(error), true);
  }
}

async function syncCartButton() {
  const section = document.querySelector('[data-npay-cart-section]');
  const container = section?.querySelector('[data-npay-cart]');
  if (!section || !container || !config || !window.Npay?.order?.create) return;
  if (sdkBlockedMessage) {
    section.hidden = false;
    setStatus(section, sdkBlockedMessage, true);
    return;
  }
  const items = currentCartItems
    .filter((item) => item?.id)
    .map((item) => ({ productId: item.id, optionId: item.optionId || '', quantity: Number(item.q) || 1 }));
  section.hidden = items.length === 0;
  if (!items.length || container.dataset.npayReady === 'true') return;

  container.dataset.npayReady = 'true';
  try {
    await window.Npay.order.create({
      buttonKey: config.buttonKey,
      containerId: container.id,
      orderRegistrationVersion: '2.1',
      type: 'template',
      colorTheme: 'green',
      enable: true,
      components: {
        wishlist: false,
        talkTalk: false,
        benefitMessage: false,
        benefitCoachMark: false,
      },
      onBuyClick: () => {
        const latest = currentCartItems
          .filter((item) => item?.id)
          .map((item) => ({ productId: item.id, optionId: item.optionId || '', quantity: Number(item.q) || 1 }));
        if (!latest.length) {
          setStatus(section, '장바구니에 상품을 먼저 담아 주세요.', true);
          return null;
        }
        return registerOrder(latest, 'cart', section);
      },
    });
  } catch (error) {
    delete container.dataset.npayReady;
    setStatus(section, buttonErrorMessage(error), true);
  }
}

export async function initializeNpay({ cartItems = [] } = {}) {
  currentCartItems = Array.isArray(cartItems) ? cartItems : [];
  if (initialized) {
    syncCartButton();
    createProductButton();
    return;
  }
  initialized = true;

  document.addEventListener('himawari:cart-change', (event) => {
    currentCartItems = Array.isArray(event.detail?.items) ? event.detail.items : [];
    syncCartButton();
  });
  document.addEventListener('himawari:product-ready', createProductButton);

  try {
    config = await requestJson('/api/npay/config');
    if (config.review && !/^\/npay-review-(?:products|product)\.html$/.test(location.pathname)) config = { ...config, enabled: false };
    if (!config.enabled) return;
    await loadSdk(config.sdkUrl);
    createProductButton();
    syncCartButton();
  } catch (error) {
    const productSection = document.querySelector('[data-npay-product-section]');
    if (productSection && config?.enabled) {
      revealProductNpay(productSection);
      setStatus(productSection, '네이버페이 버튼을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.', true);
    }
  }
}

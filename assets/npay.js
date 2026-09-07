let initialized = false;
let currentCartItems = [];
let config = null;
let sdkPromise = null;
let cardObserver = null;
const pending = new Map();

function setStatus(section, message, isError = false) {
  const status = section?.querySelector('[data-npay-status]');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('is-error', isError);
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

function createProductButton() {
  const section = document.querySelector('[data-npay-product-section]');
  const container = section?.querySelector('[data-npay-product]');
  if (!section || !container || !config || !window.Npay?.order?.create || container.dataset.npayReady === 'true') return;
  const productId = container.dataset.productId || new URLSearchParams(location.search).get('id');
  if (!productId) return;

  section.hidden = false;
  container.dataset.npayReady = 'true';
  window.Npay.order.create({
    buttonKey: config.buttonKey,
    containerId: container.id,
    orderRegistrationVersion: '2.1',
    type: 'template',
    colorTheme: 'green',
    enable: true,
    components: {
      wishlist: true,
      talkTalk: false,
      benefitMessage: true,
      benefitCoachMark: true,
    },
    onBuyClick: () => registerOrder([{ productId, quantity: 1 }], 'product', section),
    onWishlistClick: () => registerWishlist(productId, section),
  });
}

function createCardButton(section) {
  const container = section?.querySelector('[data-npay-card]');
  if (!section || !container || container.dataset.npayReady === 'true') return;
  const productId = container.dataset.productId;
  if (!productId) return;

  container.dataset.npayReady = 'true';
  try {
    window.Npay.order.create({
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
      onBuyClick: () => registerOrder([{ productId, quantity: 1 }], 'product', section),
    });
  } catch (error) {
    delete container.dataset.npayReady;
    setStatus(section, '네이버페이 버튼을 준비하지 못했습니다.', true);
  }
}

function createCardButtons() {
  if (!config || !window.Npay?.order?.create) return;
  const sections = [...document.querySelectorAll('[data-npay-card-section]')]
    .filter((section) => section.querySelector('[data-npay-card]:not([data-npay-ready="true"])'));
  if (!sections.length) return;

  sections.forEach((section) => { section.hidden = false; });
  if (!('IntersectionObserver' in window)) {
    sections.forEach(createCardButton);
    return;
  }
  if (!cardObserver) {
    cardObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        cardObserver.unobserve(entry.target);
        createCardButton(entry.target);
      });
    }, { rootMargin: '500px 0px' });
  }
  sections.forEach((section) => cardObserver.observe(section));
}

function syncCartButton() {
  const section = document.querySelector('[data-npay-cart-section]');
  const container = section?.querySelector('[data-npay-cart]');
  if (!section || !container || !config || !window.Npay?.order?.create) return;
  const items = currentCartItems
    .filter((item) => item?.id)
    .map((item) => ({ productId: item.id, quantity: Number(item.q) || 1 }));
  section.hidden = items.length === 0;
  if (!items.length || container.dataset.npayReady === 'true') return;

  container.dataset.npayReady = 'true';
  window.Npay.order.create({
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
        .map((item) => ({ productId: item.id, quantity: Number(item.q) || 1 }));
      if (!latest.length) {
        setStatus(section, '장바구니에 상품을 먼저 담아 주세요.', true);
        return null;
      }
      return registerOrder(latest, 'cart', section);
    },
  });
}

export async function initializeNpay({ cartItems = [] } = {}) {
  currentCartItems = Array.isArray(cartItems) ? cartItems : [];
  if (initialized) {
    syncCartButton();
    createProductButton();
    createCardButtons();
    return;
  }
  initialized = true;

  document.addEventListener('himawari:cart-change', (event) => {
    currentCartItems = Array.isArray(event.detail?.items) ? event.detail.items : [];
    syncCartButton();
  });
  document.addEventListener('himawari:product-ready', createProductButton);
  document.addEventListener('himawari:npay-cards-ready', createCardButtons);

  try {
    config = await requestJson('/api/npay/config');
    if (!config.enabled) return;
    await loadSdk(config.sdkUrl);
    createProductButton();
    createCardButtons();
    syncCartButton();
  } catch (error) {
    const productSection = document.querySelector('[data-npay-product-section]');
    if (productSection) {
      productSection.hidden = false;
      setStatus(productSection, '네이버페이 버튼을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.', true);
    }
  }
}

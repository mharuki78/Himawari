const productLists = document.querySelectorAll('[data-products]');

const priceFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function createProductCard(product) {
  const article = document.createElement('article');
  article.className = 'store-product-card card reveal';

  const media = document.createElement('div');
  media.className = 'store-product-media';

  const image = document.createElement('img');
  image.src = safeHttpsUrl(product.image);
  image.alt = product.name;
  image.loading = 'lazy';
  image.decoding = 'async';

  const imageFallback = document.createElement('p');
  imageFallback.className = 'product-image-fallback';
  imageFallback.textContent = '이미지를 불러오지 못했습니다.';
  imageFallback.hidden = true;

  image.addEventListener('error', () => {
    image.hidden = true;
    imageFallback.hidden = false;
    media.classList.add('is-missing');
  });

  const body = document.createElement('div');
  body.className = 'store-product-body';

  const model = product.name.match(/No\.\d+[A-Za-z]*/i)?.[0] || 'Himawari';
  const label = document.createElement('p');
  label.className = 'card-label';
  label.textContent = model;

  const name = document.createElement('h3');
  name.textContent = product.name;

  const footer = document.createElement('div');
  footer.className = 'store-product-footer';

  const price = document.createElement('strong');
  price.textContent = priceFormatter.format(product.price);

  const link = document.createElement('a');
  link.className = 'buy-link';
  link.href = safeHttpsUrl(product.url);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = '구매하기';
  link.setAttribute('aria-label', `${product.name} 구매하기 — 새 탭에서 열림`);

  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↗';
  link.append(' ', arrow);

  media.append(image, imageFallback);
  footer.append(price, link);
  body.append(label, name, footer);
  article.append(media, body);
  return article;
}

function showListState(container, message) {
  const state = document.createElement('p');
  state.className = 'product-list-state';
  state.textContent = message;
  container.replaceChildren(state);
}

async function loadProducts() {
  try {
    const response = await fetch('products.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    const products = Array.isArray(payload.products) ? payload.products : [];

    productLists.forEach((container) => {
      const limit = Number.parseInt(container.dataset.productLimit || '', 10);
      const visibleProducts = Number.isFinite(limit) ? products.slice(0, limit) : products;

      if (!visibleProducts.length) {
        showListState(container, '등록된 제품이 없습니다.');
        return;
      }

      const fragment = document.createDocumentFragment();
      visibleProducts.forEach((product) => fragment.append(createProductCard(product)));
      container.replaceChildren(fragment);
      container.setAttribute('aria-busy', 'false');
      window.himawariReveal?.(container);
    });

    document.querySelectorAll('[data-product-count]').forEach((element) => {
      element.textContent = String(products.length);
    });
  } catch {
    productLists.forEach((container) => {
      container.setAttribute('aria-busy', 'false');
      showListState(container, '제품 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.');
    });
  }
}

if (productLists.length) loadProducts();

const productLists = document.querySelectorAll('[data-products]');
const featuredProductSlots = document.querySelectorAll('[data-featured-product]');

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

function createProductMedia(product, className) {
  const media = document.createElement('div');
  media.className = className;

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

  media.append(image, imageFallback);
  return media;
}

function createCartButton(product, className = 'buy-link') {
  const link = document.createElement('button');
  link.type = 'button';
  link.className = className;
  link.textContent = '장바구니 담기';
  link.dataset.cartAdd = '';
  link.dataset.name = product.name;
  link.dataset.price = String(product.price);
  link.dataset.url = safeHttpsUrl(product.url);
  link.setAttribute('aria-label', `${product.name} 장바구니에 담기`);
  link.setAttribute('aria-live', 'polite');

  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '+';
  link.append(' ', arrow);
  return link;
}

function createDirectBuyLink(product, className = 'direct-buy-link') {
  const link = document.createElement('a');
  link.className = className;
  link.href = safeHttpsUrl(product.url) || 'https://smartstore.naver.com/baegot';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = '바로 구매하기';
  link.setAttribute('aria-label', `${product.name} 네이버 스마트스토어에서 바로 구매하기 — 새 탭에서 열림`);

  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↗';
  link.append(' ', arrow);
  return link;
}

function createProductCard(product) {
  const article = document.createElement('article');
  article.className = 'store-product-card card reveal';

  const media = createProductMedia(product, 'store-product-media');

  const body = document.createElement('div');
  body.className = 'store-product-body';

  const model = product.name.match(/No\.\d+[A-Za-z]*/i)?.[0] || 'Himawari';
  const label = document.createElement('p');
  label.className = 'card-label';
  label.textContent = model;

  const name = document.createElement('h3');
  name.textContent = product.name;

  const tagline = document.createElement('p');
  tagline.className = 'product-tagline';
  tagline.textContent = product.tagline || '일상에 자연스럽게 맞는 가방입니다.';

  const footer = document.createElement('div');
  footer.className = 'store-product-footer';

  const price = document.createElement('strong');
  price.textContent = priceFormatter.format(product.price);

  const actions = document.createElement('div');
  actions.className = 'store-product-actions';
  actions.append(createCartButton(product), createDirectBuyLink(product));

  footer.append(price, actions);
  body.append(label, name, tagline, footer);
  article.append(media, body);
  return article;
}

function createFeaturedProduct(product) {
  const article = document.createElement('article');
  article.className = 'featured-product card reveal';

  const media = createProductMedia(product, 'featured-product-media');
  const content = document.createElement('div');
  content.className = 'featured-product-content';

  const label = document.createElement('p');
  label.className = 'card-label';
  label.textContent = 'Editor’s choice · No.1884';

  const name = document.createElement('h3');
  name.textContent = product.name;

  const tagline = document.createElement('p');
  tagline.className = 'featured-tagline';
  tagline.textContent = product.tagline;

  const highlights = document.createElement('ol');
  highlights.className = 'featured-highlights';
  (Array.isArray(product.highlights) ? product.highlights : []).forEach((highlight) => {
    const item = document.createElement('li');
    item.textContent = highlight;
    highlights.append(item);
  });

  const footer = document.createElement('div');
  footer.className = 'featured-product-footer';
  const price = document.createElement('strong');
  price.textContent = priceFormatter.format(product.price);
  const actions = document.createElement('div');
  actions.className = 'featured-product-actions';
  actions.append(
    createCartButton(product, 'buy-link featured-buy-link'),
    createDirectBuyLink(product, 'direct-buy-link featured-direct-buy-link')
  );
  footer.append(price, actions);

  content.append(label, name, tagline, highlights, footer);
  article.append(media, content);
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
      const mode = container.dataset.productMode;
      let visibleProducts;

      if (mode === 'curated') {
        visibleProducts = products
          .filter((product) => Number.isFinite(product.curatedRank))
          .sort((first, second) => first.curatedRank - second.curatedRank)
          .slice(0, Number.isFinite(limit) ? limit : 5);
      } else if (mode === 'all-except-featured') {
        visibleProducts = products.filter((product) => product.featured !== true);
      } else {
        visibleProducts = Number.isFinite(limit) ? products.slice(0, limit) : products;
      }

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

    featuredProductSlots.forEach((container) => {
      const featuredProduct = products.find((product) => product.featured === true);
      if (!featuredProduct) {
        showListState(container, '대표 제품이 등록되지 않았습니다.');
        return;
      }

      container.replaceChildren(createFeaturedProduct(featuredProduct));
      container.setAttribute('aria-busy', 'false');
      window.himawariReveal?.(container);
    });

    document.querySelectorAll('[data-product-count]').forEach((element) => {
      element.textContent = String(products.length);
    });
  } catch {
    [...productLists, ...featuredProductSlots].forEach((container) => {
      container.setAttribute('aria-busy', 'false');
      showListState(container, '제품 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.');
    });
  }
}

if (productLists.length || featuredProductSlots.length) loadProducts();

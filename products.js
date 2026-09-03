const productLists = document.querySelectorAll('[data-products]');
const featuredProductSlots = document.querySelectorAll('[data-featured-product]');

export const priceFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

export function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export function productIdentifier(product, index = 0) {
  if (product?.id) return String(product.id);
  const storeNumber = safeHttpsUrl(product?.url).match(/\/products\/(\d+)/)?.[1];
  return storeNumber ? `store-${storeNumber}` : `product-${index + 1}`;
}

function normalizeProducts(products) {
  return (Array.isArray(products) ? products : []).map((product, index) => ({
    ...product,
    id: productIdentifier(product, index),
    model: product.model || product.name?.match(/No\.\d+[A-Za-z]*/i)?.[0] || 'Himawari',
    description: product.description || product.tagline || '',
    highlights: Array.isArray(product.highlights) ? product.highlights : [],
    gallery: Array.isArray(product.gallery) ? product.gallery : [],
  }));
}

export async function fetchProducts() {
  try {
    const response = await fetch('/api/products', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return normalizeProducts(payload.products);
  } catch (error) {
    const isLocalStaticPreview = location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    if (!isLocalStaticPreview) throw error;
    const response = await fetch('products.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return normalizeProducts(payload.products);
  }
}

function detailHref(product) {
  return `product.html?id=${encodeURIComponent(product.id)}`;
}

function createProductMedia(product, className) {
  const media = document.createElement('a');
  media.className = className;
  media.href = detailHref(product);
  media.setAttribute('aria-label', `${product.name} 상세페이지 보기`);
  const image = document.createElement('img');
  const imageUrl = safeHttpsUrl(product.image);
  if (imageUrl) image.src = imageUrl;
  image.alt = product.name;
  image.loading = 'lazy';
  image.decoding = 'async';
  const imageFallback = document.createElement('p');
  imageFallback.className = 'product-image-fallback';
  imageFallback.textContent = '이미지를 불러오지 못했습니다.';
  imageFallback.hidden = true;
  const showFallback = () => {
    image.hidden = true;
    imageFallback.hidden = false;
    media.classList.add('is-missing');
  };
  image.addEventListener('error', showFallback);
  if (!imageUrl) showFallback();
  media.append(image, imageFallback);
  return media;
}

function createCartButton(product, className = 'buy-link') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = '장바구니 담기';
  button.dataset.cartAdd = '';
  button.dataset.productId = product.id;
  button.dataset.name = product.name;
  button.dataset.price = String(product.price);
  button.dataset.url = safeHttpsUrl(product.url);
  button.setAttribute('aria-label', `${product.name} 장바구니에 담기`);
  button.setAttribute('aria-live', 'polite');
  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '+';
  button.append(' ', arrow);
  return button;
}

function createWishlistButton(product) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'wishlist-button';
  button.dataset.wishlistToggle = '';
  button.dataset.productId = product.id;
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', `${product.name} 관심상품 저장`);
  const label = document.createElement('span');
  label.dataset.wishlistLabel = '';
  label.textContent = '관심상품 저장';
  button.append(label);
  return button;
}

function createDirectBuyLink(product, className = 'direct-buy-link') {
  const link = document.createElement('a');
  link.className = className;
  link.href = `checkout.html?product=${encodeURIComponent(product.id)}`;
  link.textContent = '바로 구매하기';
  link.setAttribute('aria-label', `${product.name} 내부 주문서에서 바로 구매하기`);
  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '→';
  link.append(' ', arrow);
  return link;
}

function createDetailLink(product, className = 'detail-link') {
  const link = document.createElement('a');
  link.className = className;
  link.href = detailHref(product);
  link.textContent = '상세 보기';
  link.setAttribute('aria-label', `${product.name} 상세페이지 보기`);
  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '→';
  link.append(' ', arrow);
  return link;
}

function productNameHeading(product) {
  const heading = document.createElement('h3');
  const link = document.createElement('a');
  link.href = detailHref(product);
  link.textContent = product.name;
  heading.append(link);
  return heading;
}

function createProductCard(product) {
  const article = document.createElement('article');
  article.className = 'store-product-card card reveal';
  const body = document.createElement('div');
  body.className = 'store-product-body';
  const label = document.createElement('p');
  label.className = 'card-label';
  label.textContent = product.model;
  const tagline = document.createElement('p');
  tagline.className = 'product-tagline';
  tagline.textContent = product.tagline || '일상에 자연스럽게 맞는 가방입니다.';
  const footer = document.createElement('div');
  footer.className = 'store-product-footer';
  const price = document.createElement('strong');
  price.textContent = priceFormatter.format(product.price);
  const actions = document.createElement('div');
  actions.className = 'store-product-actions';
  actions.append(createDetailLink(product), createCartButton(product), createWishlistButton(product), createDirectBuyLink(product));
  footer.append(price, actions);
  body.append(label, productNameHeading(product), tagline, footer);
  article.append(createProductMedia(product, 'store-product-media'), body);
  return article;
}

function createFeaturedProduct(product) {
  const article = document.createElement('article');
  article.className = 'featured-product card reveal';
  const content = document.createElement('div');
  content.className = 'featured-product-content';
  const label = document.createElement('p');
  label.className = 'card-label';
  label.textContent = `Editor’s choice · ${product.model}`;
  const tagline = document.createElement('p');
  tagline.className = 'featured-tagline';
  tagline.textContent = product.tagline;
  const highlights = document.createElement('ol');
  highlights.className = 'featured-highlights';
  product.highlights.forEach((highlight) => {
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
    createDetailLink(product, 'detail-link featured-detail-link'),
    createCartButton(product, 'buy-link featured-buy-link'),
    createWishlistButton(product),
    createDirectBuyLink(product, 'direct-buy-link featured-direct-buy-link'),
  );
  footer.append(price, actions);
  content.append(label, productNameHeading(product), tagline, highlights, footer);
  article.append(createProductMedia(product, 'featured-product-media'), content);
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
    const products = await fetchProducts();
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

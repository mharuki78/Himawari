import { fetchProducts, priceFormatter, safeHttpsUrl } from './products.js';

const main = document.querySelector('.product-detail-main');
const loadingState = document.querySelector('[data-loading-state]');
const notFound = document.querySelector('[data-not-found]');
const content = document.querySelector('[data-product-content]');

function setMeta(selector, attribute, value) {
  const element = document.querySelector(selector);
  if (element) element.setAttribute(attribute, value);
}

function createProductImage(url, alt, eager = false) {
  const frame = document.createElement('div');
  frame.className = 'product-detail-image-frame';
  const image = document.createElement('img');
  const imageUrl = safeHttpsUrl(url);
  if (imageUrl) image.src = imageUrl;
  image.alt = alt;
  image.decoding = 'async';
  image.loading = eager ? 'eager' : 'lazy';
  if (eager) image.fetchPriority = 'high';
  const fallback = document.createElement('p');
  fallback.className = 'product-image-fallback';
  fallback.textContent = '이미지를 불러오지 못했습니다.';
  fallback.hidden = true;
  const showFallback = () => {
    image.hidden = true;
    fallback.hidden = false;
    frame.classList.add('is-missing');
  };
  image.addEventListener('error', showFallback);
  if (!imageUrl) showFallback();
  frame.append(image, fallback);
  return frame;
}

function addProductSchema(product, canonicalUrl) {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: [product.image, ...product.gallery].filter(Boolean),
    description: product.description || product.tagline,
    sku: product.model,
    brand: { '@type': 'Brand', name: 'Himawari' },
    url: canonicalUrl,
    offers: {
      '@type': 'Offer',
      url: product.url,
      priceCurrency: 'KRW',
      price: String(product.price),
    },
  });
  document.head.append(script);
}

function renderDescription(value) {
  const container = document.querySelector('[data-description]');
  const blocks = String(value || '').split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  container.replaceChildren(...blocks.map((block) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = block;
    return paragraph;
  }));
}

function renderProduct(product) {
  const canonicalUrl = `${location.origin}${location.pathname}?id=${encodeURIComponent(product.id)}`;
  const description = String(product.description || product.tagline || '').slice(0, 160);
  document.title = `${product.name} — Himawari`;
  setMeta('meta[name="description"]', 'content', description);
  setMeta('link[rel="canonical"]', 'href', canonicalUrl);
  setMeta('meta[property="og:title"]', 'content', product.name);
  setMeta('meta[property="og:description"]', 'content', description);
  setMeta('meta[property="og:url"]', 'content', canonicalUrl);
  setMeta('meta[property="og:image"]', 'content', safeHttpsUrl(product.image));
  addProductSchema(product, canonicalUrl);

  document.querySelector('[data-breadcrumb-current]').textContent = product.model;
  document.querySelector('[data-model]').textContent = product.model;
  document.querySelector('[data-name]').textContent = product.name;
  document.querySelector('[data-tagline]').textContent = product.tagline;
  document.querySelector('[data-price]').textContent = priceFormatter.format(product.price);
  document.querySelector('[data-main-image]').replaceChildren(createProductImage(product.image, product.name, true));

  const cart = document.querySelector('[data-detail-cart]');
  cart.dataset.cartAdd = '';
  cart.dataset.name = product.name;
  cart.dataset.price = String(product.price);
  cart.dataset.url = safeHttpsUrl(product.url);
  cart.setAttribute('aria-label', `${product.name} 장바구니에 담기`);

  const buyLinks = [document.querySelector('[data-direct-buy]'), document.querySelector('[data-closing-buy]')];
  buyLinks.forEach((link) => {
    link.href = safeHttpsUrl(product.url) || 'https://smartstore.naver.com/baegot';
    link.setAttribute('aria-label', `${product.name} 네이버 스마트스토어에서 확인하기 — 새 탭에서 열림`);
  });
  document.querySelector('[data-closing-title]').textContent = `${product.model}, 오래 곁에 둘 선택.`;
  renderDescription(product.description || product.tagline);

  const highlightsSection = document.querySelector('[data-highlights-section]');
  const highlights = document.querySelector('[data-highlights]');
  highlights.replaceChildren();
  product.highlights.forEach((highlight, index) => {
    const item = document.createElement('li');
    const number = document.createElement('span');
    number.textContent = String(index + 1).padStart(2, '0');
    const copy = document.createElement('p');
    copy.textContent = highlight;
    item.append(number, copy);
    highlights.append(item);
  });
  highlightsSection.hidden = product.highlights.length === 0;

  const gallerySection = document.querySelector('[data-gallery-section]');
  const gallery = document.querySelector('[data-gallery]');
  gallery.replaceChildren();
  product.gallery.forEach((url, index) => {
    gallery.append(createProductImage(url, `${product.name} 상세 이미지 ${index + 1}`));
  });
  gallerySection.hidden = product.gallery.length === 0;

  loadingState.hidden = true;
  notFound.hidden = true;
  content.hidden = false;
  main.setAttribute('aria-busy', 'false');
  window.himawariReveal?.(content);
}

function renderNotFound() {
  document.title = '제품을 찾을 수 없습니다 — Himawari';
  document.querySelector('[data-state-kicker]').textContent = 'Product not found';
  document.querySelector('[data-state-title]').textContent = '제품을 찾을 수 없습니다.';
  document.querySelector('[data-state-message]').textContent = '주소가 잘못되었거나 관리자에 의해 삭제된 제품일 수 있습니다.';
  document.querySelector('[data-state-action]').href = 'products.html';
  document.querySelector('[data-state-action-label]').textContent = '전체 제품으로 돌아가기';
  loadingState.hidden = true;
  content.hidden = true;
  notFound.hidden = false;
  main.setAttribute('aria-busy', 'false');
  document.querySelector('[data-state-title]').focus?.();
}

function renderUnavailable() {
  document.title = '제품 정보를 불러오지 못했습니다 — Himawari';
  document.querySelector('[data-state-kicker]').textContent = 'Temporary error';
  document.querySelector('[data-state-title]').textContent = '제품 정보를 불러오지 못했습니다.';
  document.querySelector('[data-state-message]').textContent = '잠시 후 다시 시도해 주세요. 입력한 제품 주소는 그대로 유지됩니다.';
  document.querySelector('[data-state-action]').href = location.href;
  document.querySelector('[data-state-action-label]').textContent = '다시 시도하기';
  loadingState.hidden = true;
  content.hidden = true;
  notFound.hidden = false;
  main.setAttribute('aria-busy', 'false');
  document.querySelector('[data-state-title]').focus?.();
}

async function loadProduct() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    renderNotFound();
    return;
  }
  try {
    const products = await fetchProducts();
    const product = products.find((item) => item.id === id);
    if (!product) {
      renderNotFound();
      return;
    }
    renderProduct(product);
  } catch {
    renderUnavailable();
  }
}

loadProduct();

import { CATALOG_CATEGORIES, filterAndSortFamilies, groupProductFamilies } from './assets/catalog-tools.js';

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
  return (Array.isArray(products) ? products : []).map((product, index) => {
    const hasNaverPrice = Number(product.naverPrice) > 0;
    const naverPrice = hasNaverPrice ? Number(product.naverPrice) : Number(product.price || 0);
    return {
      ...product,
      id: productIdentifier(product, index),
      model: product.model || product.name?.match(/No\.\d+[A-Za-z]*/i)?.[0] || 'Himawari',
      naverPrice,
      price: hasNaverPrice ? Number(product.price || naverPrice) : naverPrice,
      naverDiscountRate: Number.isInteger(Number(product.naverDiscountRate)) ? Number(product.naverDiscountRate) : null,
      description: product.description || product.tagline || '',
      highlights: Array.isArray(product.highlights) ? product.highlights : [],
      gallery: Array.isArray(product.gallery) ? product.gallery : [],
      optionName: product.optionName || '',
      options: Array.isArray(product.options) ? product.options : [],
      stock: product.stock === null || product.stock === undefined ? null : Number(product.stock),
      soldOut: product.soldOut === true || (product.stock !== null && product.stock !== undefined && Number(product.stock) === 0),
    };
  });
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
  if (product.options.length) {
    const link = document.createElement('a');
    link.className = className;
    link.href = `${detailHref(product)}#product-options`;
    link.textContent = '옵션 선택';
    link.setAttribute('aria-label', `${product.name} 옵션 선택 후 장바구니에 담기`);
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    link.append(' ', arrow);
    return link;
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = '장바구니 담기';
  button.dataset.cartAdd = '';
  button.dataset.productId = product.id;
  button.dataset.name = product.name;
  button.dataset.price = String(product.price);
  button.dataset.url = safeHttpsUrl(product.url);
  button.dataset.stock = product.stock === null ? '' : String(product.stock);
  button.setAttribute('aria-label', `${product.name} 장바구니에 담기`);
  button.setAttribute('aria-live', 'polite');
  button.disabled = product.soldOut;
  if (product.soldOut) button.textContent = '품절';
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
  if (product.options.length) {
    const link = createDetailLink(product, className);
    link.href = `${detailHref(product)}#product-options`;
    link.firstChild.textContent = '옵션 선택';
    link.setAttribute('aria-label', `${product.name} 옵션 선택 후 바로 구매하기`);
    return link;
  }
  if (product.soldOut) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = '품절';
    button.disabled = true;
    return button;
  }
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

function npayContainerId(product) {
  return `npay-home-${String(product.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function createNpaySection(product) {
  const section = document.createElement('section');
  section.className = 'npay-card-purchase';
  section.dataset.npayCardSection = '';
  section.dataset.hasOptions = product.options.length ? 'true' : 'false';
  section.dataset.soldOut = product.soldOut ? 'true' : 'false';
  section.hidden = true;
  section.setAttribute('aria-label', `${product.name} 네이버페이 구매`);

  const label = document.createElement('p');
  label.className = 'npay-card-purchase__label';
  label.textContent = 'Npay 바로 구매';

  const container = document.createElement('div');
  container.id = npayContainerId(product);
  container.className = 'npay-card-button-container';
  container.dataset.npayCard = '';
  container.dataset.productId = product.id;

  const status = document.createElement('p');
  status.className = 'npay-status';
  status.dataset.npayStatus = '';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  section.append(label, container, status);
  return section;
}

function productNameHeading(product) {
  const heading = document.createElement('h3');
  const link = document.createElement('a');
  link.href = detailHref(product);
  link.textContent = product.name;
  heading.append(link);
  return heading;
}

function createPriceBlock(product) {
  const block = document.createElement('div');
  block.className = 'product-price-block';
  if (Number.isInteger(product.naverDiscountRate) && product.naverDiscountRate > 0) {
    const badge = document.createElement('span');
    badge.className = 'product-discount-badge';
    badge.textContent = `네이버 ${product.naverDiscountRate}% 할인`;
    block.append(badge);
  }
  const price = document.createElement('strong');
  price.textContent = priceFormatter.format(product.price);
  block.append(price);
  if (Number.isInteger(product.stock) && product.stock > 0 && product.stock <= 5) {
    const stock = document.createElement('span');
    stock.className = 'product-low-stock';
    stock.textContent = `품절 임박 · ${product.stock}개`;
    block.append(stock);
  }
  return block;
}

function createProductCard(product, { includeNpay = false, family = null } = {}) {
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
  const actions = document.createElement('div');
  actions.className = 'store-product-actions';
  actions.append(createDetailLink(product), createCartButton(product), createWishlistButton(product), createDirectBuyLink(product));
  footer.append(createPriceBlock(product), actions);
  if (includeNpay) footer.append(createNpaySection(product));
  body.append(label, productNameHeading(product), tagline, footer);
  if (family?.variants?.length > 1) {
    const variants = document.createElement('div');
    variants.className = 'product-variants';
    const summary = document.createElement('span');
    summary.textContent = `${family.variants.length}가지 선택`;
    variants.append(summary);
    family.variants.slice(0, 6).forEach((variant) => {
      const link = document.createElement('a');
      link.href = detailHref(variant);
      link.textContent = variant.name.match(/(블랙|블루|핑크|카키|아이보리|실버|그레이|베이지|브라운|민트|퍼플|레드|옐로|오렌지|그린|네이비|화이트)M?/)?.[0] || variant.model;
      link.setAttribute('aria-label', `${variant.name} 보기`);
      variants.append(link);
    });
    body.insertBefore(variants, footer);
  }
  article.append(createProductMedia(product, 'store-product-media'), body);
  return article;
}

function createFeaturedProduct(product, { includeNpay = false } = {}) {
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
  const actions = document.createElement('div');
  actions.className = 'featured-product-actions';
  actions.append(
    createDetailLink(product, 'detail-link featured-detail-link'),
    createCartButton(product, 'buy-link featured-buy-link'),
    createWishlistButton(product),
    createDirectBuyLink(product, 'direct-buy-link featured-direct-buy-link'),
  );
  footer.append(createPriceBlock(product), actions);
  if (includeNpay) footer.append(createNpaySection(product));
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
    const families = groupProductFamilies(products);
    productLists.forEach((container) => {
      const limit = Number.parseInt(container.dataset.productLimit || '', 10);
      const mode = container.dataset.productMode;
      let visibleProducts;
      if (mode === 'curated') {
        visibleProducts = products
          .filter((product) => Number.isFinite(product.curatedRank))
          .sort((first, second) => first.curatedRank - second.curatedRank)
          .slice(0, Number.isFinite(limit) ? limit : 5);
      } else if (mode === 'featured-families') {
        visibleProducts = families.filter((family) => !family.representative.featured).slice(0, Number.isFinite(limit) ? limit : 7);
      } else if (mode === 'catalog') {
        setupCatalog(container, families);
        return;
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
      const includeNpay = container.hasAttribute('data-npay-cards');
      visibleProducts.forEach((entry) => {
        const family = entry?.representative ? entry : null;
        fragment.append(createProductCard(family?.representative || entry, { includeNpay, family }));
      });
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
      container.replaceChildren(createFeaturedProduct(featuredProduct, {
        includeNpay: container.hasAttribute('data-npay-cards'),
      }));
      container.setAttribute('aria-busy', 'false');
      window.himawariReveal?.(container);
    });
    document.querySelectorAll('[data-product-count]').forEach((element) => {
      element.textContent = String(products.length);
    });
    document.dispatchEvent(new CustomEvent('himawari:npay-cards-ready'));
  } catch {
    [...productLists, ...featuredProductSlots].forEach((container) => {
      container.setAttribute('aria-busy', 'false');
      showListState(container, '제품 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.');
    });
  }
}

function setupCatalog(container, families) {
  const form = document.querySelector('[data-catalog-controls]');
  const search = form?.querySelector('[data-catalog-search]');
  const sort = form?.querySelector('[data-catalog-sort]');
  const categories = form?.querySelector('[data-catalog-categories]');
  const count = document.querySelector('[data-catalog-result-count]');
  const more = document.querySelector('[data-catalog-more]');
  const empty = document.querySelector('[data-catalog-empty]');
  const params = new URLSearchParams(location.search);
  let state = {
    query: params.get('q') || '',
    category: CATALOG_CATEGORIES.some((item) => item.id === (document.body.dataset.collection || params.get('category'))) ? (document.body.dataset.collection || params.get('category')) : 'all',
    sort: ['featured', 'price-low', 'price-high', 'name'].includes(params.get('sort')) ? params.get('sort') : 'featured',
    shown: 12,
  };
  if (search) search.value = state.query;
  if (sort) sort.value = state.sort;
  if (categories && !categories.children.length) {
    CATALOG_CATEGORIES.forEach((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.category = category.id;
      button.textContent = category.label;
      categories.append(button);
    });
  }

  const render = ({ focusGrid = false } = {}) => {
    const filtered = filterAndSortFamilies(families, state);
    const visible = filtered.slice(0, state.shown);
    const fragment = document.createDocumentFragment();
    const includeNpay = container.hasAttribute('data-npay-cards');
    visible.forEach((family) => fragment.append(createProductCard(family.representative, { includeNpay, family })));
    container.replaceChildren(fragment);
    container.setAttribute('aria-busy', 'false');
    if (count) count.textContent = `${filtered.length}개 제품군`;
    if (empty) empty.hidden = filtered.length > 0;
    if (more) {
      more.hidden = visible.length >= filtered.length;
      more.textContent = `제품 더 보기 (${filtered.length - visible.length})`;
    }
    categories?.querySelectorAll('[data-category]').forEach((button) => {
      const selected = button.dataset.category === state.category;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const url = new URL(location.href);
    state.query ? url.searchParams.set('q', state.query) : url.searchParams.delete('q');
    if (!document.body.dataset.collection) state.category !== 'all' ? url.searchParams.set('category', state.category) : url.searchParams.delete('category');
    state.sort !== 'featured' ? url.searchParams.set('sort', state.sort) : url.searchParams.delete('sort');
    history.replaceState(null, '', url);
    window.himawariReveal?.(container);
    document.dispatchEvent(new CustomEvent('himawari:npay-cards-ready'));
    if (focusGrid) container.querySelector('article a')?.focus();
  };

  let inputTimer;
  search?.addEventListener('input', (event) => {
    if (event.isComposing) return;
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => {
      state = { ...state, query: search.value, shown: 12 };
      render();
    }, 160);
  });
  search?.addEventListener('compositionend', () => {
    clearTimeout(inputTimer);
    state = { ...state, query: search.value, shown: 12 };
    render();
  });
  sort?.addEventListener('change', () => {
    state = { ...state, sort: sort.value, shown: 12 };
    render();
  });
  categories?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state = { ...state, category: button.dataset.category, shown: 12 };
    render();
  });
  more?.addEventListener('click', () => {
    state = { ...state, shown: state.shown + 12 };
    render({ focusGrid: true });
  });
  form?.addEventListener('reset', () => {
    requestAnimationFrame(() => {
      state = { query: '', category: 'all', sort: 'featured', shown: 12 };
      render();
    });
  });
  render();
}

if (productLists.length || featuredProductSlots.length) loadProducts();

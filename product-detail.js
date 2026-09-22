import { productFamilyKey, productVariantLabel } from './assets/catalog-tools.js';
import { purchaseQuantity, purchaseLimit } from './assets/purchase-quantity.js';
import { reviewGroupKey } from './assets/review-groups.js';
import { createReviewCard } from './assets/review-card.js';
import { fetchProducts, priceFormatter, safeHttpsUrl } from './products.js';
import { renderProductGuidance } from './assets/product-guidance.js';
import { initCompareTray, createCompareButton } from './assets/compare-store.js';
import { productPurchaseFacts, productEvidenceHighlights } from './assets/product-facts.js';

const main = document.querySelector('.product-detail-main');
const loadingState = document.querySelector('[data-loading-state]');
const notFound = document.querySelector('[data-not-found]');
const content = document.querySelector('[data-product-content]');

function setMeta(selector, attribute, value) {
  const element = document.querySelector(selector);
  if (element) element.setAttribute(attribute, value);
}

function createProductImage(url, alt, { eager = false, longform = false } = {}) {
  const frame = document.createElement('div');
  frame.className = 'product-detail-image-frame';
  if (longform) frame.classList.add('product-detail-image-frame--longform');
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

function renderDescription(value) {
  const container = document.querySelector('[data-description]');
  const blocks = String(value || '').split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  container.replaceChildren(...blocks.map((block) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = block;
    return paragraph;
  }));
}

function configureInventory(product, cart, buyLinks, npayProduct, products) {
  const picker = document.querySelector('[data-option-picker]');
  const select = document.querySelector('[data-product-option]');
  const stockStatus = document.querySelector('[data-stock-status]');
  const selectedPrice = document.querySelector('[data-selected-price]');
  const optionError = document.querySelector('[data-option-error]');
  const options = Array.isArray(product.options) ? product.options : [];
  const sticky = document.querySelector('[data-mobile-purchase]');
  const stickyBuy = sticky?.querySelector('[data-sticky-buy]');
  const stickySelect = sticky?.querySelector('[data-sticky-select]');
  const minus = sticky?.querySelector('[data-quantity-minus]');
  const plus = sticky?.querySelector('[data-quantity-plus]');
  const quantityOutput = sticky?.querySelector('[data-purchase-quantity]');
  let selectedOption = null;
  let quantity = purchaseQuantity(new URLSearchParams(location.search).get('quantity'), product.stock);
  const restockForm = document.querySelector('[data-restock-form]');
  const setBuyState = (option = null) => {
    selectedOption = option;
    const available = option ? option.stock : product.stock;
    quantity = purchaseQuantity(quantity, available);
    const unavailable = product.soldOut || (option && option.stock < 1);
    if (quantityOutput) quantityOutput.value = String(quantity);
    if (minus) minus.disabled = unavailable || quantity <= 1;
    if (plus) plus.disabled = unavailable || quantity >= purchaseLimit(available);
    if (sticky) sticky.querySelector('[data-sticky-price]').textContent = priceFormatter.format(product.price * quantity);
    cart.dataset.quantity = String(quantity);
    const needsOption = options.length > 0 && !option;
    cart.disabled = unavailable || needsOption;
    cart.dataset.optionId = option?.id || '';
    cart.dataset.optionLabel = option?.label || '';
    cart.dataset.stock = option ? String(option.stock) : (product.stock === null ? '' : String(product.stock));
    buyLinks.forEach((link) => {
      const enabled = !unavailable && !needsOption;
      if (enabled) {
        link.href = `checkout.html?product=${encodeURIComponent(product.id)}${option ? `&option=${encodeURIComponent(option.id)}` : ''}&quantity=${quantity}`;
        link.removeAttribute('aria-disabled');
      } else {
        link.removeAttribute('href');
        link.setAttribute('aria-disabled', 'true');
      }
    });
    if (stickyBuy) {
      const enabled = !unavailable && !needsOption;
      if (enabled) {
        stickyBuy.href = `checkout.html?product=${encodeURIComponent(product.id)}${option ? `&option=${encodeURIComponent(option.id)}` : ''}&quantity=${quantity}`;
        stickyBuy.removeAttribute('aria-disabled');
      } else {
        stickyBuy.removeAttribute('href');
        stickyBuy.setAttribute('aria-disabled', 'true');
      }
    }
    if (stickySelect && options.length) stickySelect.value = option?.id || '';
    if (restockForm) {
      restockForm.hidden = !unavailable;
      restockForm.dataset.optionId = option?.id || '';
    }
    if (npayProduct) {
      npayProduct.dataset.quantity = String(quantity);
      npayProduct.dataset.stock = available === null ? '' : String(available);
      npayProduct.dataset.optionId = option?.id || '';
      npayProduct.dataset.hasOptions = options.length ? 'true' : 'false';
      npayProduct.dataset.soldOut = unavailable ? 'true' : 'false';
    }
  };

  minus?.addEventListener('click', () => { quantity -= 1; setBuyState(selectedOption); });
  plus?.addEventListener('click', () => { quantity += 1; setBuyState(selectedOption); });
  if (!options.length) {
    if (stickySelect) {
      const variants = products.filter(p => productFamilyKey(p) === productFamilyKey(product));
      stickySelect.replaceChildren(...variants.map(p => {
        const item = document.createElement('option');
        item.value = p.id;
        item.textContent = (p.name.includes('SET') ? 'SET · ' : '') + productVariantLabel(p) + (p.soldOut ? ' · 품절' : ' · ' + priceFormatter.format(p.price));
        item.disabled = p.soldOut && p.id !== product.id;
        return item;
      }));
      stickySelect.value = product.id;
      stickySelect.disabled = variants.length < 2;
      sticky.querySelector('[data-purchase-help]').textContent = variants.length > 1 ? '색상·구성 변경 시 해당 상품으로 이동합니다.' : '현재 상품의 단일 옵션입니다.';
      stickySelect.addEventListener('change', () => {
        const variant = variants.find(p => p.id === stickySelect.value);
        if (!variant || variant.id === product.id) return;
        const url = new URL(location.href);
        url.searchParams.set('id', variant.id);
        url.searchParams.set('quantity', String(purchaseQuantity(quantity, variant.stock)));
        location.assign(url.href);
      });
    }
    picker.hidden = true;
    const badge = document.createElement('span');
    badge.className = `product-stock-badge${product.soldOut ? ' is-sold-out' : ''}`;
    badge.textContent = product.soldOut ? '품절' : (product.stock === null ? '현재 주문 가능' : `재고 ${product.stock}개`);
    document.querySelector('.product-detail-pricing')?.append(badge);
    setBuyState();
    return;
  }

  picker.hidden = false;
  document.querySelector('#product-option-label').textContent = product.optionName || '옵션 선택';
  select.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = `${product.optionName || '옵션'}을 선택해 주세요`;
  select.append(placeholder);
  options.forEach((option) => {
    const item = document.createElement('option');
    item.value = option.id;
    item.textContent = `${option.label}${option.stock < 1 ? ' · 품절' : ` · 재고 ${option.stock}개`}`;
    item.disabled = option.stock < 1;
    select.append(item);
  });
  if (stickySelect) {
    stickySelect.replaceChildren(...[...select.options].map(item => item.cloneNode(true)));
    stickySelect.addEventListener('change', () => {
      select.value = stickySelect.value;
      select.dispatchEvent(new Event('change'));
    });
    sticky.querySelector('[data-purchase-help]').textContent = '옵션과 수량은 구매하기와 Npay에 동일하게 적용됩니다.';
  }
  select.addEventListener('change', () => {
    const option = options.find((item) => item.id === select.value) || null;
    optionError.textContent = '';
    select.setAttribute('aria-invalid', 'false');
    stockStatus.textContent = option ? `${option.label} · ${option.stock}개 주문 가능` : '옵션을 선택하면 주문 버튼이 활성화됩니다.';
    selectedPrice.textContent = option ? priceFormatter.format(product.price) : '';
    setBuyState(option);
  });
  [cart, ...buyLinks].forEach((control) => control.addEventListener('click', (event) => {
    if (select.value) return;
    event.preventDefault();
    optionError.textContent = '주문할 옵션을 먼저 선택해 주세요.';
    select.setAttribute('aria-invalid', 'true');
    select.focus();
  }));
  stockStatus.textContent = product.soldOut ? '모든 옵션이 품절되었습니다.' : '옵션을 선택하면 주문 버튼이 활성화됩니다.';
  setBuyState();
}

function setupCustomerFeatures(product) {
  const restockForm = document.querySelector('[data-restock-form]');
  restockForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = restockForm.querySelector('button');
    const status = restockForm.querySelector('[data-restock-status]');
    const invalid = [...restockForm.querySelectorAll('[required]')].find((control) => !control.validity.valid);
    if (invalid) { status.textContent = '이메일과 알림 동의를 확인해 주세요.'; invalid.focus(); return; }
    button.disabled = true;
    status.textContent = '신청하고 있습니다.';
    try {
      const response = await fetch('/api/restock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: product.id, optionId: restockForm.dataset.optionId || '', email: restockForm.elements.email.value, consent: restockForm.elements.consent.checked }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      status.textContent = payload.message;
      restockForm.reset();
    } catch (error) {
      status.textContent = error.message || '알림을 신청하지 못했습니다.';
    } finally { button.disabled = false; }
  });

  const list = document.querySelector('[data-review-list]');
  const summary = document.querySelector('[data-review-summary]');
  let reviewOffset = 0;
  const moreReviews = document.createElement('button');
  moreReviews.type = 'button';
  moreReviews.textContent = '리뷰 더 보기';
  moreReviews.hidden = true;
  list?.after(moreReviews);
  const loadReviews = async () => {
    if (!list) return;
    moreReviews.disabled = true;
    try {
      const response = await fetch(`/api/reviews?productId=${encodeURIComponent(product.id)}&offset=${reviewOffset}&group=${encodeURIComponent(reviewGroupKey(product.name, product.model))}`, { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const payload = await response.json();
      if (reviewOffset === 0) list.replaceChildren();
      (payload.reviews || []).forEach((review) => list.append(createReviewCard(review)));
      if (!payload.reviews?.length) list.textContent = '아직 공개된 리뷰가 없습니다. 첫 사용 기록을 남겨주세요.';
      const externalSources = [
        payload.aggregate?.naverCount ? `네이버 ${payload.aggregate.naverCount}개` : '',
        payload.aggregate?.coupangCount ? `쿠팡 ${payload.aggregate.coupangCount}개` : '',
      ].filter(Boolean).join(' · ');
      summary.textContent = payload.aggregate?.count ? `평균 ${payload.aggregate.ratingValue}점 · 리뷰 ${payload.aggregate.count}개${externalSources ? ` (${externalSources} 포함)` : ''}` : '배송 완료 주문만 리뷰를 남길 수 있습니다.';
      const quickReview = document.querySelector('[data-quick-review]');
      if (quickReview) quickReview.textContent = payload.aggregate?.count ? `${payload.aggregate.ratingValue}점 · 리뷰 ${payload.aggregate.count}개` : '리뷰 살펴보기';
      moreReviews.hidden = payload.nextOffset == null;
      reviewOffset = payload.nextOffset ?? reviewOffset;
      moreReviews.textContent = '리뷰 더 보기';
    } catch {
      if (reviewOffset === 0) list.textContent = '리뷰를 불러오지 못했습니다.';
      moreReviews.hidden = false;
      moreReviews.textContent = '리뷰 다시 불러오기';
    } finally { moreReviews.disabled = false; }
  };
  moreReviews.addEventListener('click', loadReviews);
  loadReviews();

  const reviewForm = document.querySelector('[data-review-form]');
  reviewForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = reviewForm.querySelector('button');
    const status = reviewForm.querySelector('[data-review-form-status]');
    const invalid = [...reviewForm.querySelectorAll('[required]')].find((control) => !control.validity.valid);
    if (invalid) { status.textContent = '주문정보, 평점, 10자 이상의 리뷰와 공개 동의를 확인해 주세요.'; invalid.focus(); return; }
    const image = reviewForm.elements.image.files?.[0];
    if (image && (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type) || image.size > 2_000_000)) {
      status.textContent = '리뷰 사진은 JPG, PNG, WebP 형식의 2MB 이하 파일만 가능합니다.';
      reviewForm.elements.image.focus();
      return;
    }
    const data = new FormData(reviewForm);
    data.set('productId', product.id);
    button.disabled = true;
    status.textContent = '리뷰를 안전하게 등록하고 있습니다.';
    try {
      const response = await fetch('/api/reviews', { method: 'POST', body: data });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      status.textContent = payload.message;
      reviewForm.reset();
    } catch (error) { status.textContent = error.message || '리뷰를 등록하지 못했습니다.'; }
    finally { button.disabled = false; }
  });
}

function renderProduct(product, products) {
  document.querySelectorAll('a[href^="#"], .product-section-nav a, .purchase-reassurance a').forEach(link => {
    const fragment = new URL(link.getAttribute('href'), location.href).hash;
    if (fragment) link.href = `${location.pathname}${location.search}${fragment}`;
  });
  const canonicalUrl = `${location.origin}${location.pathname}?id=${encodeURIComponent(product.id)}`;
  const description = String(product.description || product.tagline || '').slice(0, 160);
  document.title = `${product.name} — Himawari`;
  setMeta('meta[name="description"]', 'content', description);
  setMeta('link[rel="canonical"]', 'href', canonicalUrl);
  setMeta('meta[property="og:title"]', 'content', product.name);
  setMeta('meta[property="og:description"]', 'content', description);
  setMeta('meta[property="og:url"]', 'content', canonicalUrl);
  setMeta('meta[property="og:image"]', 'content', safeHttpsUrl(product.image));

  document.querySelector('[data-breadcrumb-current]').textContent = product.model;
  document.querySelector('[data-model]').textContent = product.model;
  document.querySelector('[data-name]').textContent = product.name;
  document.querySelector('[data-tagline]').textContent = product.tagline;
  document.querySelector('[data-price]').textContent = priceFormatter.format(product.price);
  const facts = document.querySelector('[data-purchase-facts]');
  facts?.replaceChildren(...productPurchaseFacts(product).map(({ label, value }) => {
    const row = document.createElement('div'); const dt = document.createElement('dt'); const dd = document.createElement('dd');
    dt.textContent = label; dd.textContent = value; row.append(dt, dd); return row;
  }));
  initCompareTray(products);
  document.querySelector('[data-detail-compare]')?.replaceChildren(createCompareButton(product));
  const discountRate = document.querySelector('[data-naver-discount]');
  discountRate.hidden = !(Number.isInteger(product.naverDiscountRate) && product.naverDiscountRate > 0);
  discountRate.textContent = discountRate.hidden ? '' : `네이버 ${product.naverDiscountRate}% 할인`;
  document.querySelector('[data-main-image]').replaceChildren(createProductImage(product.image, product.name, { eager: true }));

  const cart = document.querySelector('[data-detail-cart]');
  cart.dataset.cartAdd = '';
  cart.dataset.productId = product.id;
  cart.dataset.name = product.name;
  cart.dataset.price = String(product.price);
  cart.dataset.url = safeHttpsUrl(product.url);
  cart.setAttribute('aria-label', `${product.name} 장바구니에 담기`);

  const wishlist = document.querySelector('[data-detail-wishlist]');
  wishlist.dataset.productId = product.id;
  wishlist.setAttribute('aria-label', `${product.name} 관심상품 저장`);

  const buyLinks = [document.querySelector('[data-direct-buy]'), document.querySelector('[data-closing-buy]')];
  buyLinks.forEach((link) => {
    link.href = `checkout.html?product=${encodeURIComponent(product.id)}`;
    link.removeAttribute('target');
    link.removeAttribute('rel');
    link.setAttribute('aria-label', `${product.name} 내부 주문서에서 바로 구매하기`);
  });
  const npayProduct = document.querySelector('[data-npay-product]');
  if (npayProduct) npayProduct.dataset.productId = product.id;
  configureInventory(product, cart, buyLinks, npayProduct, products);
  setupCustomerFeatures(product);
  const sticky = document.querySelector('[data-mobile-purchase]');
  if (sticky) {
    sticky.hidden = false;
    sticky.querySelector('[data-sticky-model]').textContent = product.model;


    const updateBarSpace = () => document.body.style.setProperty('--purchase-bar-height', sticky.getBoundingClientRect().height + 'px');
    updateBarSpace();
    if ('ResizeObserver' in window) new ResizeObserver(updateBarSpace).observe(sticky);
  }
  document.querySelector('[data-closing-title]').textContent = `${product.model}, 오래 곁에 둘 선택.`;
  renderDescription(product.description || product.tagline);

  const highlightsSection = document.querySelector('[data-highlights-section]');
  const highlights = document.querySelector('[data-highlights]');
  highlights.replaceChildren();
  const evidence = productEvidenceHighlights(product);
  evidence.forEach(({ label, value }) => {
    const item = document.createElement('li');
    const number = document.createElement('span');
    number.textContent = label;
    const copy = document.createElement('p');
    copy.textContent = value;
    item.append(number, copy);
    highlights.append(item);
  });
  highlightsSection.hidden = evidence.length === 0;

  const gallerySection = document.querySelector('[data-gallery-section]');
  const gallery = document.querySelector('[data-gallery]');
  gallery.replaceChildren();
  product.gallery.forEach((url, index) => {
    gallery.append(createProductImage(url, `${product.name} 상세 이미지 ${index + 1}`, { longform: true }));
  });
  gallerySection.hidden = product.gallery.length === 0;
  const photoLink = document.querySelector('.product-section-nav a[href$="#product-photos"]');
  if (photoLink) photoLink.hidden = product.gallery.length === 0;

  loadingState.hidden = true;
  notFound.hidden = true;
  content.hidden = false;
  main.setAttribute('aria-busy', 'false');
  window.himawariReveal?.(content);
  document.dispatchEvent(new CustomEvent('himawari:product-ready', { detail: { productId: product.id } }));
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
    renderProduct(product, products);
    renderProductGuidance(product, products);
  } catch {
    renderUnavailable();
  }
}

loadProduct();

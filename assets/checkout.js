import { purchaseQuantity } from './purchase-quantity.js';
import { initializeCheckoutNpay } from './npay.js?v=20261112-cart-convenience';
import { checkoutCartLine, checkoutItemsInput, removePurchasedCartItems, mergeRemainingCart } from './black-friday-cart.js?v=20261112-checkout-prices';
import { bankTransfer, bankTransferReady } from './bank-transfer.js';
import { WELCOME_COUPON, welcomeCouponSubtotal } from './welcome-coupon.js';
import { standardShippingFee } from './shipping-policy.js';
import { orderBenefits } from './order-summary.js';
(function () {
  'use strict';

  var loading = document.querySelector('[data-checkout-loading]');
  var failure = document.querySelector('[data-checkout-error]');
  var failureTitle = document.querySelector('#checkout-error-title');
  var failureMessage = document.querySelector('[data-checkout-error-message]');
  var retry = document.querySelector('[data-checkout-retry]');
  var workspace = document.querySelector('[data-checkout-content]');
  var form = document.querySelector('[data-checkout-form]');
  var summary = document.querySelector('[data-order-form-summary]');
  var submitStatus = document.querySelector('[data-checkout-submit-status]');
  var submitButton = form.querySelector('button[type="submit"]');
  var submitLabel = document.querySelector('[data-order-submit-label]');
  var itemContainer = document.querySelector('[data-checkout-items]');
  var complete = document.querySelector('[data-order-complete]');
  var guestNote = document.querySelector('[data-checkout-guest-note]');
  var memberOrderLink = document.querySelector('[data-member-order-link]');
  var guestOrderLink = document.querySelector('[data-guest-order-link]');
  var discardDialog = document.querySelector('[data-order-discard-dialog]');
  var discardCancel = document.querySelector('[data-order-discard-cancel]');
  var discardConfirm = document.querySelector('[data-order-discard-confirm]');
  var couponOptions = document.querySelector('[data-coupon-options]');
  var couponError = document.querySelector('#coupon-error');
  var priceFormatter = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 });
  var items = [];
  var coupons = [];
  var welcomeExcluded = [];
  var requestId = crypto.randomUUID();
  var cartOrder = false;
  var saleOfferId = new URLSearchParams(location.search).get('blackFriday');
  var saleOffer = null;
  var saleExpiryTimer = null;
  function hasSaleItems() { return saleOfferId !== null || items.some(function (item) { return item.blackFriday != null; }); }
  if (saleOfferId !== null) {
    document.querySelector('[data-npay-checkout-section]').hidden = true;
    document.querySelector('[data-coupon-fieldset]').hidden = true;
    document.querySelector('[data-black-friday-checkout]').hidden = false;
    document.querySelector('[data-black-friday-return]').hidden = false;
  }
  var memberOrder = false;
  var dirty = false;
  var submitted = false;
  var pendingHref = '';
  var checkoutStorageKey = 'himawari-checkout-items';
  var gameRewardStorageKey = 'himawari-game-coupon-v1';
  var preferredGameCouponId = '';
  var couponTokens = {};
  var couponRequests = {};
  var paymentMethod = '';
  var kakaopayEnabled = false;
  var kakaopayButton = document.querySelector('[data-kakaopay-select]');
  var paymentSelection = document.querySelector('[data-payment-selection]');
  var paymentOptions = document.querySelector('[data-payment-options]');
  var paymentChange = document.querySelector('[data-payment-change]');
  var paymentNotice = document.querySelector('[data-payment-notice]');

  function showPaymentOptions(show) {
    paymentOptions.hidden = !show;
    paymentChange.setAttribute('aria-expanded', String(show));
    paymentChange.textContent = show ? '닫기' : '변경';
    document.querySelector('#purchase-method-title').textContent = show ? (paymentMethod ? '결제 방법 변경' : '구매 방법을 선택하세요.') : '선택한 결제 방법';
    updateMobileAction();
  }

  function prepareNpay() {
    if (hasSaleItems()) return;
    initializeCheckoutNpay(() => items.map(item => ({ productId: item.productId, optionId: item.optionId || '', quantity: item.quantity })), () => { dirty = false; });
  }

  function selectPayment(method, options) {
    if (method === 'kakaopay' ? !kakaopayEnabled : method !== 'bank_transfer' || !bankTransferReady()) return;
    paymentMethod = method;
    var kakao = method === 'kakaopay';
    paymentSelection.hidden = false;
    paymentNotice.hidden = true;
    document.querySelector('[data-payment-name]').textContent = kakao ? '카카오페이' : '무통장입금';
    document.querySelector('[data-payment-description]').textContent = kakao ? '배송정보 입력 후 카카오페이 결제창으로 이어집니다.' : '주문 접수 후 안내 계좌로 입금해 주세요.';
    showPaymentOptions(false);
    form.hidden = false;
    document.querySelector('#payment-title').textContent = kakao ? '카카오페이 결제 안내' : '무통장입금 안내';
    document.querySelector('[data-bank-instructions]').hidden = kakao;
    document.querySelector('[data-kakaopay-instructions]').hidden = !kakao;
    submitLabel.textContent = kakao ? '카카오페이로 결제하기' : '무통장입금 주문 접수';
    submitButton.classList.toggle('kakaopay-button', kakao);
    bankButton.setAttribute('aria-expanded', String(!kakao));
    kakaopayButton.setAttribute('aria-expanded', String(kakao));
    renderTotals();
    var url = new URL(location.href);
    url.searchParams.set('payment', method);
    history.replaceState(null, '', url);
    if (!options || options.focus !== false) field('recipientName').focus();
  }

  paymentChange.addEventListener('click', function () {
    var opening = paymentOptions.hidden;
    showPaymentOptions(opening);
    if (opening) {
      prepareNpay();
      document.querySelector('#purchase-method-title').focus();
    }
  });

  function readCouponWallet() { try { return JSON.parse(localStorage.getItem('himawari-coupon-wallet-v1')) || {}; } catch (error) { return {}; } }
  function saveCouponWallet() { try { localStorage.setItem('himawari-coupon-wallet-v1', JSON.stringify(couponTokens)); } catch (error) {} }
  async function issueCoupon(couponId) {
    if (couponId === WELCOME_COUPON.id) return '';
    if (!couponId || couponTokens[couponId]) return couponTokens[couponId] || '';
    if (couponRequests[couponId]) return couponRequests[couponId];
    couponError.textContent = '쿠폰을 안전하게 발급하고 있습니다.';
    couponRequests[couponId] = request('/api/coupons/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ couponId: couponId, source: 'checkout' }) }).then(function (payload) {
      couponTokens[couponId] = payload.token; saveCouponWallet(); couponError.textContent = '쿠폰을 발급했습니다. 이 주문에 한 번 사용할 수 있습니다.'; return payload.token;
    }).finally(function () { delete couponRequests[couponId]; });
    return couponRequests[couponId];
  }

  function readGameReward() {
    try {
      var reward = JSON.parse(localStorage.getItem(gameRewardStorageKey));
      return reward && typeof reward.couponId === 'string' ? reward : null;
    } catch (error) {
      return null;
    }
  }

  function request(url, options) {
    return fetch(url, Object.assign({ cache: 'no-store' }, options || {})).then(async function (response) {
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        var error = new Error(payload.message || '요청을 처리하지 못했습니다.');
        error.status = response.status;
        error.fieldErrors = payload.fieldErrors || {};
        throw error;
      }
      return payload;
    });
  }

  function safeImage(value) {
    try { var url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch (error) { return ''; }
  }

  function showOnly(target) {
    [loading, failure, workspace, complete].forEach(function (element) { element.hidden = element !== target; });
    updateMobileAction();
  }

  function selectedCoupon() {
    if (hasSaleItems()) return null;
    var checked = form.querySelector('input[name="couponId"]:checked');
    return coupons.find(function (coupon) { return coupon.id === (checked ? checked.value : ''); }) || null;
  }

  function welcomeSubtotal() {
    return welcomeCouponSubtotal(items.map(function (item) {
      return { ...item, unitPrice: item.product.price };
    }), welcomeExcluded);
  }

  function totals() {
    var subtotal = items.reduce(function (sum, item) { return sum + item.product.price * item.quantity; }, 0);
    var shippingFee = standardShippingFee(subtotal);
    var coupon = selectedCoupon();
    var discountAmount = 0;
    if (coupon && (coupon.id !== WELCOME_COUPON.id || paymentMethod) && subtotal >= Number(coupon.minimumSubtotal || 0)) {
      if (coupon.type === 'free_shipping') shippingFee = 0;
      if (coupon.type === 'percent') {
        var discountBase = coupon.id === WELCOME_COUPON.id ? welcomeSubtotal() : subtotal;
        discountAmount = Math.floor(discountBase * Number(coupon.rate || 0) / 100);
        if (Number(coupon.maximumDiscount || 0) > 0) discountAmount = Math.min(discountAmount, Number(coupon.maximumDiscount));
      }
    }
    return { subtotal: subtotal, discountAmount: discountAmount, shippingFee: shippingFee, total: subtotal - discountAmount + shippingFee };
  }

  function renderTotals() {
    var value = totals();
    var benefit = orderBenefits(items.map(function (item) { return {unitPrice:item.product.price,quantity:item.quantity,campaign:Boolean(item.blackFriday),regularPrice:item.saleDisplay?.regularPrice}; }), value);
    document.querySelector('[data-order-savings-row]').hidden = !benefit.totalSavings;
    document.querySelector('[data-order-savings]').textContent = priceFormatter.format(benefit.totalSavings) + ' 할인';
    document.querySelector('[data-order-shipping-progress-text]').textContent = benefit.remaining ? priceFormatter.format(benefit.remaining) + ' 더 담으면 무료배송' : '무료배송 적용';
    document.querySelector('[data-order-shipping-progress]').value = benefit.progress;
    document.querySelector('[data-order-count]').textContent = items.reduce(function (sum, item) { return sum + item.quantity; }, 0) + '개';
    document.querySelector('[data-order-subtotal]').textContent = priceFormatter.format(value.subtotal);
    document.querySelector('[data-order-discount-row]').hidden = value.discountAmount === 0;
    document.querySelector('[data-order-discount]').textContent = '−' + priceFormatter.format(value.discountAmount);
    document.querySelector('[data-order-shipping]').textContent = value.shippingFee ? priceFormatter.format(value.shippingFee) : '무료';
    document.querySelector('[data-order-total]').textContent = priceFormatter.format(value.total);
    document.querySelector('[data-mobile-total]').textContent = priceFormatter.format(value.total);
    updateMobileAction();
  }

  function updateMobileAction() {
    var action = document.querySelector('[data-mobile-checkout]');
    action.textContent = !paymentMethod || !paymentOptions.hidden ? '구매 방법 선택' : submitLabel.textContent;
    action.disabled = submitButton.disabled || submitted || workspace.hidden;
    action.setAttribute('aria-busy', submitButton.getAttribute('aria-busy') === 'true' ? 'true' : 'false');
  }
  document.querySelector('[data-mobile-checkout]').addEventListener('click', function () {
    if (workspace.hidden || submitButton.disabled || submitted) return;
    if (!paymentMethod || !paymentOptions.hidden) {
      showPaymentOptions(true);
      paymentOptions.scrollIntoView?.({block:'center',behavior:'auto'});
      paymentOptions.querySelector('button:not([disabled])')?.focus();
    } else { form.requestSubmit(submitButton); }
  });
  if (window.visualViewport) {
    var keyboardVisibility = function () {
      var active = document.activeElement;
      var typing = active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName);
      document.querySelector('[data-mobile-action]').setAttribute('data-keyboard-open', String(Boolean(typing && window.innerHeight - window.visualViewport.height > 150)));
    };
    window.visualViewport.addEventListener('resize',keyboardVisibility);
    document.addEventListener('focusin',keyboardVisibility);
    document.addEventListener('focusout',function () { setTimeout(keyboardVisibility,0); });
  }

  function couponDescription(coupon) {
    var parts = [coupon.type === 'free_shipping' ? '기본 배송비 3,500원 면제' : '상품금액 ' + coupon.rate + '% 할인'];
    if (coupon.id === WELCOME_COUPON.id) parts.push('행사 상품 제외 · 무통장입금 또는 카카오페이');
    if (coupon.minimumSubtotal) parts.push(priceFormatter.format(coupon.minimumSubtotal) + ' 이상');
    if (coupon.maximumDiscount) parts.push('최대 ' + priceFormatter.format(coupon.maximumDiscount));
    if (coupon.expiresAt) parts.push(new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' }).format(new Date(coupon.expiresAt)) + '까지');
    return parts.join(' · ');
  }

  function renderCoupons() {
    var selected = form.querySelector('input[name="couponId"]:checked');
    var eligibleWelcome = Math.floor(welcomeSubtotal() * WELCOME_COUPON.rate / 100) > 0;
    var welcome = coupons.some(function (coupon) { return coupon.id === WELCOME_COUPON.id; });
    var current = selected ? selected.value : preferredGameCouponId || (welcome && eligibleWelcome ? WELCOME_COUPON.id : '');
    var subtotal = items.reduce(function (sum, item) { return sum + item.product.price * item.quantity; }, 0);
    var currentCoupon = coupons.find(function (coupon) { return coupon.id === current; });
    if (currentCoupon && (subtotal < Number(currentCoupon.minimumSubtotal || 0) || (current === WELCOME_COUPON.id && !eligibleWelcome))) current = '';
    couponOptions.replaceChildren();
    var available = [{ id: '', label: '쿠폰 사용 안 함', type: 'none', minimumSubtotal: 0 }].concat(coupons);
    available.forEach(function (coupon) {
      var label = document.createElement('label');
      label.className = 'coupon-option';
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'couponId';
      input.value = coupon.id;
      input.checked = coupon.id === current || (!available.some(function (item) { return item.id === current; }) && coupon.id === '');
      var minimumMissing = coupon.id && subtotal < Number(coupon.minimumSubtotal || 0);
      var welcomeExcludedOnly = coupon.id === WELCOME_COUPON.id && !eligibleWelcome;
      input.disabled = Boolean(minimumMissing || welcomeExcludedOnly);
      var copy = document.createElement('span');
      var strong = document.createElement('strong');
      strong.textContent = coupon.label + (coupon.id && coupon.id === preferredGameCouponId ? ' · 게임 획득' : '');
      var detail = document.createElement('small');
      detail.textContent = coupon.id ? couponDescription(coupon) + (minimumMissing ? ' · 금액 조건 미달' : welcomeExcludedOnly ? ' · 적용 대상 없음' : '') : '기본 배송 정책으로 주문합니다.';
      copy.append(strong, detail);
      label.append(input, copy);
      couponOptions.append(label);
    });
    if (!coupons.length) {
      var note = document.createElement('p');
      note.className = 'coupon-empty';
      note.textContent = '현재 활성화된 쿠폰이 없습니다.';
      couponOptions.append(note);
    }
  }

  function renderItems() {
    if (saleExpiryTimer !== null) { clearTimeout(saleExpiryTimer); saleExpiryTimer = null; }
    itemContainer.replaceChildren();
    if (items.some(function (entry) { return entry.saleDisplay && Date.now() >= Date.parse(entry.saleDisplay.endsAt); })) {
      failureMessage.textContent = '행사가 종료되었습니다. 장바구니에서 상품과 가격을 다시 확인해 주세요.';
      submitButton.disabled = true;
      showOnly(failure);
      failureTitle.focus();
      return false;
    }
    items.forEach(function (entry, index) {
      var product = entry.product;
      var article = document.createElement('article');
      article.className = 'checkout-item';
      var imageUrl = safeImage(product.image);
      var media;
      if (imageUrl) {
        media = document.createElement('img');
        media.src = imageUrl;
        media.alt = '';
      } else {
        media = document.createElement('span');
        media.className = 'checkout-item__fallback';
        media.textContent = '이미지 준비 중';
      }
      var copy = document.createElement('div');
      var model = document.createElement('p');
      model.textContent = product.model || 'Himawari';
      var name = document.createElement('h3');
      name.textContent = product.name;
      var option = document.createElement('p');
      option.className = 'checkout-item__option';
      option.textContent = entry.optionLabel || '';
      option.hidden = !entry.optionLabel;
      var meta = document.createElement('div');
      meta.className = 'checkout-item__meta';
      var quantity = document.createElement('span');
      quantity.className = 'checkout-item__quantity';
      var minus = document.createElement('button');
      minus.type = 'button';
      minus.textContent = '−';
      minus.setAttribute('aria-label', product.name + ' 수량 줄이기');
      minus.disabled = entry.quantity <= 1;
      minus.addEventListener('click', function () { if (entry.quantity > 1) { entry.quantity -= 1; dirty = true; renderItems(); } });
      var count = document.createElement('span');
      count.textContent = String(entry.quantity);
      var plus = document.createElement('button');
      plus.type = 'button';
      plus.textContent = '+';
      plus.setAttribute('aria-label', product.name + ' 수량 늘리기');
      var maximum = entry.stock === null || entry.stock === undefined ? 99 : Math.min(99, Number(entry.stock));
      plus.disabled = entry.quantity >= maximum;
      plus.addEventListener('click', function () { if (entry.quantity < maximum) { entry.quantity += 1; dirty = true; renderItems(); } });
      quantity.append(minus, count, plus);
      var amount = document.createElement('strong');
      amount.textContent = priceFormatter.format(product.price * entry.quantity);
      meta.append(quantity, amount);
      copy.append(model, name, option);
      if (entry.blackFriday && entry.saleDisplay) {
        var prices = document.createElement('div');
        prices.className = 'checkout-item__prices';
        var regular = entry.saleDisplay.regularPrice;
        var deal = document.createElement('div');
        deal.className = 'checkout-item__deal';
        var unitPrice = document.createElement('strong');
        unitPrice.className = 'checkout-item__sale-price';
        unitPrice.textContent = '개당 행사가 ' + priceFormatter.format(product.price);
        if (Number.isSafeInteger(regular) && regular > product.price) {
          var original = document.createElement('del');
          original.textContent = '개당 정상가 ' + priceFormatter.format(regular);
          prices.append(original);
          var discount = document.createElement('span');
          discount.className = 'checkout-item__discount';
          var percent = Math.min(99, Math.round((regular - product.price) / regular * 100));
          discount.textContent = (percent ? percent + '%' : '1% 미만') + ' 할인';
          deal.append(unitPrice, discount);
        } else { deal.append(unitPrice); }
        prices.append(deal);
        copy.append(prices);
        var lineTotal = document.createElement('span');
        lineTotal.className = 'checkout-item__line-total';
        var totalLabel = document.createElement('span');
        totalLabel.textContent = '상품금액';
        lineTotal.append(totalLabel, amount);
        meta.replaceChildren(quantity, lineTotal);
      }
      copy.append(meta);
      article.append(media, copy);
      itemContainer.append(article);
    });
    if (!hasSaleItems()) renderCoupons();
    renderTotals();
    var deadlines = items.filter(function (entry) { return entry.saleDisplay; }).map(function (entry) { return Date.parse(entry.saleDisplay.endsAt); });
    if (deadlines.length) saleExpiryTimer = setTimeout(function () {
      saleExpiryTimer = null;
      if (!submitted) renderItems();
    }, Math.min(Math.max(0, Math.min.apply(null, deadlines) - Date.now()), 2147483647));
  }

  function field(name) { return form.elements.namedItem(name); }
  function errorElement(name) {
    var map = {
      recipientName: 'recipient-name-error', email: 'order-email-error', phone: 'recipient-phone-error',
      postalCode: 'postal-code-error', addressLine1: 'address-line1-error',
      termsConsent: 'terms-consent-error', privacyConsent: 'privacy-consent-error'
    };
    return map[name] ? document.getElementById(map[name]) : null;
  }

  function setFieldError(name, message) {
    if (name === 'couponId') {
      couponError.textContent = message || '';
      document.querySelector('[data-coupon-fieldset]').setAttribute('aria-invalid', message ? 'true' : 'false');
      return;
    }
    var input = field(name);
    var target = errorElement(name);
    if (target) target.textContent = message || '';
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function clearErrors() {
    ['recipientName', 'email', 'phone', 'postalCode', 'addressLine1', 'couponId', 'termsConsent', 'privacyConsent'].forEach(function (name) { setFieldError(name, ''); });
    summary.hidden = true;
    summary.textContent = '';
    submitStatus.textContent = '';
  }

  function validate() {
    clearErrors();
    var values = Object.fromEntries(new FormData(form));
    values.termsConsent = field('termsConsent').checked;
    values.privacyConsent = field('privacyConsent').checked;
    var errors = {};
    if (String(values.recipientName || '').trim().length < 2) errors.recipientName = '받는 분 이름을 2자 이상 입력해 주세요.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(values.email || '').trim())) errors.email = '주문 안내를 받을 이메일 주소를 확인해 주세요.';
    if (!/^\+?[0-9][0-9\s-]{7,19}$/.test(String(values.phone || '').trim())) errors.phone = '연락 가능한 전화번호를 숫자와 하이픈으로 입력해 주세요.';
    if (String(values.postalCode || '').trim().length < 3) errors.postalCode = '우편번호를 입력해 주세요.';
    if (String(values.addressLine1 || '').trim().length < 5) errors.addressLine1 = '배송받을 기본 주소를 입력해 주세요.';
    if (!values.termsConsent) errors.termsConsent = '주문하려면 이용약관에 동의해 주세요.';
    if (!values.privacyConsent) errors.privacyConsent = '주문 배송정보 수집·이용에 동의해 주세요.';
    var names = Object.keys(errors);
    names.forEach(function (name) { setFieldError(name, errors[name]); });
    if (names.length) {
      summary.textContent = '입력하지 않았거나 확인이 필요한 항목이 있습니다. 각 항목의 안내를 확인해 주세요.';
      summary.hidden = false;
      field(names[0]).focus();
      return null;
    }
    return values;
  }

  document.querySelectorAll('[data-bank-account]').forEach(function (node) { node.textContent = [bankTransfer.bank, bankTransfer.account, bankTransfer.holder && '예금주 ' + bankTransfer.holder].filter(Boolean).join(' · '); });
  var bankButton = document.querySelector('[data-bank-select]');
  bankButton.disabled = !bankTransferReady();
  document.querySelector('[data-bank-availability]').textContent = bankTransferReady() ? '' : (saleOfferId === null ? '입금 계좌를 준비하고 있습니다. Npay로 구매해 주세요.' : '입금 계좌를 준비하고 있습니다.');
  bankButton.addEventListener('click', function () {
    selectPayment('bank_transfer');
  });
  kakaopayButton.addEventListener('click', function () { if (kakaopayEnabled) selectPayment('kakaopay'); });

  async function load() {
    if (saleExpiryTimer !== null) { clearTimeout(saleExpiryTimer); saleExpiryTimer = null; }
    showOnly(loading);
    paymentMethod = '';
    form.hidden = true;
    paymentSelection.hidden = true;
    paymentNotice.hidden = true;
    showPaymentOptions(true);
    try {
      var session = await request('/api/auth/session');
      var welcomePayload = saleOfferId === null && session.authenticated === true
        ? await request('/api/orders?route=welcome-coupon').catch(function () { return null; }) : null;
      var payConfig = await request('/api/kakaopay/config').catch(function () { return {enabled:false}; });
      kakaopayEnabled = payConfig.enabled === true;
      document.querySelector('[data-kakaopay-section]').hidden = !kakaopayEnabled;
      kakaopayButton.disabled = !kakaopayEnabled;
      var promotionPayload = saleOfferId === null ? await request('/api/promotions').catch(function () { return { coupons: [] }; }) : { coupons: [] };
      coupons = Array.isArray(promotionPayload.coupons) ? promotionPayload.coupons : [];
      welcomeExcluded = [];
      if (welcomePayload?.available) {
        coupons = [WELCOME_COUPON].concat(coupons);
        welcomeExcluded = welcomePayload.excluded || [];
      }
      document.querySelector('[data-npay-welcome-note]').hidden = !welcomePayload?.available;
      var gameReward = readGameReward();
      couponTokens = readCouponWallet();
      if (gameReward?.couponId && gameReward?.token) { couponTokens[gameReward.couponId] = gameReward.token; saveCouponWallet(); }
      preferredGameCouponId = gameReward && coupons.some(function (coupon) { return coupon.id === gameReward.couponId; }) ? gameReward.couponId : '';
      memberOrder = session.authenticated === true;
      guestNote.hidden = memberOrder;
      var productId = new URLSearchParams(location.search).get('product');
      if (saleOfferId !== null) {
        var salePayload = await request('/api/black-friday');
        saleOffer = salePayload.state === 'open' && salePayload.items.find(function (item) { return item.offerId === saleOfferId; });
        if (!saleOffer || saleOffer.remaining < 1) throw new Error('행사가 끝났거나 이 품목의 행사 수량이 모두 소진됐습니다.');
        var saleQuantity = purchaseQuantity(new URLSearchParams(location.search).get('quantity'), saleOffer.remaining);
        items = [checkoutCartLine({ productId: saleOffer.productId, optionId: saleOffer.optionId, quantity: saleQuantity,
          blackFriday: { offerId: saleOffer.offerId, unitPrice: saleOffer.price } }, { ...saleOffer, id: saleOffer.productId }, salePayload)];
        cartOrder = false;
        if (!kakaopayEnabled && !bankTransferReady()) {
          paymentNotice.textContent = '현재 행사 결제를 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.';
          paymentNotice.hidden = false;
        }
      } else if (productId) {
        var productPayload = await request('/api/products?id=' + encodeURIComponent(productId));
        var optionId = new URLSearchParams(location.search).get('option') || '';
        var selectedOption = (productPayload.product.options || []).find(function (option) { return option.id === optionId; });
        if ((productPayload.product.options || []).length && !selectedOption) throw Object.assign(new Error('주문할 옵션을 다시 선택해 주세요.'), { status: 400 });
        if ((selectedOption ? selectedOption.stock : productPayload.product.stock) === 0) throw Object.assign(new Error('선택한 상품이 품절되었습니다.'), { status: 409 });
        items = [{ productId: productPayload.product.id, optionId: optionId, optionLabel: selectedOption ? selectedOption.label : '', stock: selectedOption ? selectedOption.stock : productPayload.product.stock, quantity: purchaseQuantity(new URLSearchParams(location.search).get('quantity'), selectedOption ? selectedOption.stock : productPayload.product.stock), product: productPayload.product }];
        cartOrder = false;
      } else {
        var checkoutIntent = null;
        try { checkoutIntent = JSON.parse(sessionStorage.getItem(checkoutStorageKey)); } catch (error) {}
        var intendedItems = checkoutIntent && Date.now() - Number(checkoutIntent.createdAt) < 30 * 60 * 1000 && Array.isArray(checkoutIntent.items)
          ? checkoutIntent.items
          : [];
        if (intendedItems.length) {
          if (intendedItems.length > 30) throw new Error('한 주문에는 최대 30개 품목을 담을 수 있습니다. 장바구니에서 주문할 품목을 줄여 주세요.');
          var catalogPayload = await request('/api/products');
          var byId = new Map((catalogPayload.products || []).map(function (product) { return [product.id, product]; }));
          var cartSale = intendedItems.some(function (item) { return item.blackFriday != null; }) ? await request('/api/black-friday') : null;
          items = intendedItems.map(function (item) { return checkoutCartLine(item, byId.get(String(item.productId || '')), cartSale); });
        } else if (memberOrder) {
          var cartPayload = await request('/api/member/cart');
          var memberSale = (cartPayload.items || []).some(function (item) { return item.blackFriday != null; }) ? await request('/api/black-friday') : null;
          items = (cartPayload.items || []).map(function (item) { return checkoutCartLine(item, item.product, memberSale); });
        }
        cartOrder = true;
      }
      if (!items.length) throw Object.assign(new Error('장바구니가 비어 있습니다. 제품을 담은 뒤 다시 주문해 주세요.'), { status: 400 });
      var saleMode = hasSaleItems();
      document.querySelector('[data-npay-checkout-section]').hidden = saleMode;
      document.querySelector('[data-coupon-fieldset]').hidden = saleMode;
      document.querySelector('[data-coupon-fieldset]').disabled = saleMode;
      document.querySelector('[data-black-friday-checkout]').hidden = !saleMode;
      document.querySelector('[data-black-friday-return]').hidden = !saleMode;
      if (saleMode) coupons = [];
      if (memberOrder) {
        field('recipientName').value = session.user.displayName || '';
        field('email').value = session.user.email || '';
      }
      if (renderItems() === false) return;
      if (submitButton.getAttribute('aria-busy') !== 'true') submitButton.disabled = false;
      showOnly(workspace);
      var requestedPayment = new URLSearchParams(location.search).get('payment');
      if (requestedPayment === 'kakaopay' && kakaopayEnabled) selectPayment('kakaopay', { focus: false });
      if (requestedPayment === 'bank_transfer' && bankTransferReady()) selectPayment('bank_transfer', { focus: false });
      if ((requestedPayment === 'kakaopay' && !kakaopayEnabled) || (requestedPayment === 'bank_transfer' && !bankTransferReady())) {
        paymentNotice.textContent = '선택한 결제 방법을 현재 이용할 수 없습니다. 다른 방법을 선택해 주세요.';
        paymentNotice.hidden = false;
      }
      if (!paymentOptions.hidden) prepareNpay();
    } catch (error) {
      failureMessage.textContent = error.message;
      showOnly(failure);
      failureTitle.focus();
    }
  }

  form.addEventListener('input', function (event) {
    dirty = true;
    if (event.target.name) setFieldError(event.target.name, '');
    summary.hidden = true;
    submitStatus.textContent = '';
    if (event.target.name === 'couponId') {
      renderTotals();
      if (event.target.value) issueCoupon(event.target.value).catch(function (reason) { event.target.checked = false; form.querySelector('input[name="couponId"][value=""]').checked = true; renderTotals(); couponError.textContent = reason.message || '쿠폰을 발급하지 못했습니다.'; });
    }
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (submitButton.disabled || (paymentMethod === 'kakaopay' ? !kakaopayEnabled : !bankTransferReady()) || form.hidden) return;
    var values = validate();
    if (!values) return;
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    submitLabel.textContent = paymentMethod === 'kakaopay' ? '결제창 준비 중' : '주문 접수 중';
    updateMobileAction();
    submitStatus.textContent = '상품 가격과 배송비를 서버에서 다시 확인하고 있습니다.';
    try {
      var payload = await request(paymentMethod === 'kakaopay' ? '/api/kakaopay/ready' : '/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: requestId,
          paymentMethod: paymentMethod,
          items: checkoutItemsInput(items),
          recipientName: values.recipientName,
          email: values.email,
          phone: values.phone,
          postalCode: values.postalCode,
          addressLine1: values.addressLine1,
          addressLine2: values.addressLine2,
          deliveryNote: values.deliveryNote,
          couponId: values.couponId || '',
          couponToken: values.couponId ? (couponTokens[values.couponId] || await issueCoupon(values.couponId)) : '',
          ...(values.couponId === WELCOME_COUPON.id ? { welcomeDiscountAmount: totals().discountAmount } : {}),
          termsConsent: values.termsConsent,
          privacyConsent: values.privacyConsent
        })
      });
      if (paymentMethod === 'kakaopay') {
        try { sessionStorage.setItem('himawari-kakaopay-checkout',JSON.stringify({orderId:payload.orderId,state:payload.state,cartOrder:cartOrder,memberOrder:memberOrder,items:checkoutItemsInput(items),createdAt:Date.now()})); } catch (error) {}
        dirty = false;
        var redirect = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? payload.mobile : payload.pc;
        location.assign(redirect);
        return;
      }
      var order = payload.order;
      window.himawariTrack?.('Order submitted', { itemCount: items.length, total: Number(order.total || 0), paymentState: 'pending' });
      submitted = true;
      dirty = false;
      if (cartOrder) {
        var localRemaining = window.SiteCart ? removePurchasedCartItems(window.SiteCart.items(), checkoutItemsInput(items)) : [];
        if (memberOrder) {
          try {
            var latest = await request('/api/member/cart');
            var remaining = removePurchasedCartItems(latest.items || [], checkoutItemsInput(items));
            await request('/api/member/cart', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: checkoutItemsInput(remaining) }) });
            localRemaining = mergeRemainingCart(localRemaining, remaining);
          } catch (error) { /* Order remains valid if account-cart cleanup is temporarily unavailable. */ }
        }
        if (window.SiteCart) window.SiteCart.replace(localRemaining, !memberOrder);
        try { sessionStorage.removeItem(checkoutStorageKey); } catch (error) {}
      }
      document.querySelector('[data-complete-number]').textContent = order.orderNumber;
      document.querySelector('[data-complete-total]').textContent = priceFormatter.format(order.total);
      memberOrderLink.hidden = !memberOrder;
      guestOrderLink.hidden = memberOrder;
      if (!memberOrder) guestOrderLink.href = 'guest-order.html?order=' + encodeURIComponent(order.orderNumber);
      document.title = '주문 접수 완료 — Himawari';
      showOnly(complete);
      document.querySelector('#order-complete-title').focus();
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    } catch (error) {
      Object.entries(error.fieldErrors || {}).forEach(function (entry) { setFieldError(entry[0], entry[1]); });
      submitStatus.textContent = error.message || '주문을 접수하지 못했습니다. 입력 내용은 유지되며 같은 주문번호로 다시 시도합니다.';
      var first = Object.keys(error.fieldErrors || {})[0];
      if (first === 'couponId') document.querySelector('[data-coupon-fieldset]').focus();
      else if (first && field(first)) field(first).focus();
      else submitStatus.focus?.();
    } finally {
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
      submitLabel.textContent = paymentMethod === 'kakaopay' ? '카카오페이로 결제하기' : '무통장입금 주문 접수';
      updateMobileAction();
    }
  });

  retry.addEventListener('click', load);
  document.querySelector('[data-address-search]')?.addEventListener('click', function () {
    function openPostcode() {
      new window.daum.Postcode({ oncomplete: function (data) { field('postalCode').value = data.zonecode || ''; field('addressLine1').value = data.roadAddress || data.jibunAddress || ''; field('addressLine2').focus(); dirty = true; setFieldError('postalCode', ''); setFieldError('addressLine1', ''); } }).open();
    }
    if (window.daum && window.daum.Postcode) return openPostcode();
    var script = document.createElement('script'); script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'; script.onload = openPostcode; script.onerror = function () { submitStatus.textContent = '주소 검색을 불러오지 못했습니다. 주소를 직접 입력해 주세요.'; }; document.head.append(script);
  });
  discardCancel.addEventListener('click', function () { pendingHref = ''; discardDialog.close(); });
  discardConfirm.addEventListener('click', function () { var href = pendingHref; dirty = false; discardDialog.close(); if (href) location.href = href; });
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href]');
    if (!dirty || submitted || !link || link.target === '_blank' || link.getAttribute('href').startsWith('#')) return;
    event.preventDefault();
    pendingHref = link.href;
    discardDialog.showModal();
    discardCancel.focus();
  });
  window.addEventListener('beforeunload', function (event) { if (dirty && !submitted) { event.preventDefault(); event.returnValue = ''; } });
  load();
})();

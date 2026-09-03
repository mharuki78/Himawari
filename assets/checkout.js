(function () {
  'use strict';

  var loading = document.querySelector('[data-checkout-loading]');
  var login = document.querySelector('[data-checkout-login]');
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
  var discardDialog = document.querySelector('[data-order-discard-dialog]');
  var discardCancel = document.querySelector('[data-order-discard-cancel]');
  var discardConfirm = document.querySelector('[data-order-discard-confirm]');
  var priceFormatter = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 });
  var items = [];
  var requestId = crypto.randomUUID();
  var cartOrder = false;
  var dirty = false;
  var submitted = false;
  var pendingHref = '';
  var checkoutStorageKey = 'himawari-checkout-items';

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
    [loading, login, failure, workspace, complete].forEach(function (element) { element.hidden = element !== target; });
  }

  function totals() {
    var subtotal = items.reduce(function (sum, item) { return sum + item.product.price * item.quantity; }, 0);
    var shippingFee = subtotal >= 100000 ? 0 : 3500;
    return { subtotal: subtotal, shippingFee: shippingFee, total: subtotal + shippingFee };
  }

  function renderTotals() {
    var value = totals();
    document.querySelector('[data-order-count]').textContent = items.reduce(function (sum, item) { return sum + item.quantity; }, 0) + '개';
    document.querySelector('[data-order-subtotal]').textContent = priceFormatter.format(value.subtotal);
    document.querySelector('[data-order-shipping]').textContent = value.shippingFee ? priceFormatter.format(value.shippingFee) : '무료';
    document.querySelector('[data-order-total]').textContent = priceFormatter.format(value.total);
  }

  function renderItems() {
    itemContainer.replaceChildren();
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
      plus.disabled = entry.quantity >= 99;
      plus.addEventListener('click', function () { if (entry.quantity < 99) { entry.quantity += 1; dirty = true; renderItems(); } });
      quantity.append(minus, count, plus);
      var amount = document.createElement('strong');
      amount.textContent = priceFormatter.format(product.price * entry.quantity);
      meta.append(quantity, amount);
      copy.append(model, name, meta);
      article.append(media, copy);
      itemContainer.append(article);
    });
    renderTotals();
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
    var input = field(name);
    var target = errorElement(name);
    if (target) target.textContent = message || '';
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function clearErrors() {
    ['recipientName', 'email', 'phone', 'postalCode', 'addressLine1', 'termsConsent', 'privacyConsent'].forEach(function (name) { setFieldError(name, ''); });
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

  async function load() {
    showOnly(loading);
    try {
      var session = await request('/api/auth/session');
      if (!session.authenticated) { showOnly(login); return; }
      var productId = new URLSearchParams(location.search).get('product');
      if (productId) {
        var productPayload = await request('/api/products?id=' + encodeURIComponent(productId));
        items = [{ productId: productPayload.product.id, quantity: 1, product: productPayload.product }];
        cartOrder = false;
      } else {
        var checkoutIntent = null;
        try { checkoutIntent = JSON.parse(sessionStorage.getItem(checkoutStorageKey)); } catch (error) {}
        var intendedItems = checkoutIntent && Date.now() - Number(checkoutIntent.createdAt) < 30 * 60 * 1000 && Array.isArray(checkoutIntent.items)
          ? checkoutIntent.items
          : [];
        if (intendedItems.length) {
          var catalogPayload = await request('/api/products');
          var byId = new Map((catalogPayload.products || []).map(function (product) { return [product.id, product]; }));
          items = intendedItems.slice(0, 30).flatMap(function (item) {
            var product = byId.get(String(item.productId || ''));
            var quantity = Math.min(99, Math.max(1, Number(item.quantity) || 1));
            return product ? [{ productId: product.id, quantity: quantity, product: product }] : [];
          });
        } else {
          var cartPayload = await request('/api/member/cart');
          items = (cartPayload.items || []).map(function (item) { return { productId: item.productId, quantity: item.quantity, product: item.product }; });
        }
        cartOrder = true;
      }
      if (!items.length) throw Object.assign(new Error('장바구니가 비어 있습니다. 제품을 담은 뒤 다시 주문해 주세요.'), { status: 400 });
      field('recipientName').value = session.user.displayName || '';
      field('email').value = session.user.email || '';
      renderItems();
      showOnly(workspace);
    } catch (error) {
      if (error.status === 401) { showOnly(login); return; }
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
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (submitButton.disabled) return;
    var values = validate();
    if (!values) return;
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    submitLabel.textContent = '주문 접수 중';
    submitStatus.textContent = '상품 가격과 배송비를 서버에서 다시 확인하고 있습니다.';
    try {
      var payload = await request('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: requestId,
          items: items.map(function (item) { return { productId: item.productId, quantity: item.quantity }; }),
          recipientName: values.recipientName,
          email: values.email,
          phone: values.phone,
          postalCode: values.postalCode,
          addressLine1: values.addressLine1,
          addressLine2: values.addressLine2,
          deliveryNote: values.deliveryNote,
          termsConsent: values.termsConsent,
          privacyConsent: values.privacyConsent
        })
      });
      var order = payload.order;
      submitted = true;
      dirty = false;
      if (cartOrder) {
        await request('/api/member/cart', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [] }) }).catch(function () {});
        if (window.SiteCart) window.SiteCart.clear();
        try { sessionStorage.removeItem(checkoutStorageKey); } catch (error) {}
      }
      document.querySelector('[data-complete-number]').textContent = order.orderNumber;
      document.querySelector('[data-complete-total]').textContent = priceFormatter.format(order.total);
      document.title = '주문 접수 완료 — Himawari';
      showOnly(complete);
      document.querySelector('#order-complete-title').focus();
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    } catch (error) {
      Object.entries(error.fieldErrors || {}).forEach(function (entry) { setFieldError(entry[0], entry[1]); });
      submitStatus.textContent = error.message || '주문을 접수하지 못했습니다. 입력 내용은 유지되며 같은 주문번호로 다시 시도합니다.';
      var first = Object.keys(error.fieldErrors || {})[0];
      if (first && field(first)) field(first).focus();
      else submitStatus.focus?.();
    } finally {
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
      submitLabel.textContent = '결제 대기로 주문 접수';
    }
  });

  retry.addEventListener('click', load);
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

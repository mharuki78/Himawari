/* ==========================================================================
   장바구니 부품 키트 — cart.js
   실행DAY 2026-08-29 · https://runday.irumai.kr/260829/kit/cart/

   ● 장바구니 상품은 Himawari 내부 주문서로 이어집니다.
     PG 연결 전에는 주문이 결제 대기 상태로 접수되며 결제를 완료한 것으로
     표시하지 않습니다.

   ● 붙이는 법
     1) </head> 앞:  <link rel="stylesheet" href="assets/cart.css">
     2) </body> 앞:  <script src="assets/cart.js" defer></script>
     3) 담기 버튼:   <button data-cart-add
                       data-name="제품명" data-price="34000"
                       data-url="https://smartstore.naver.com/...">담기</button>

   ● 커스터마이즈 (cart.js 위쪽, 또는 페이지의 인라인 <script>에서)
     window.CART_KEY  = 'mybrand-cart';        // localStorage 키
     window.CART_TEXT = { title:'장바구니', empty:'...', note:'...',
                          copy:'주문 목록 복사', ask:'문자로 주문 문의',
                          go:'스토어에서 주문 →' };
   ========================================================================== */
import { orderBenefits } from './order-summary.js';
import { variantChoices, replaceCartOption } from './cart-options.js';
(function () {
  'use strict';

  /* ───────── 설정 ───────── */
  var KEY = (typeof window.CART_KEY === 'string' && window.CART_KEY) || 'site-cart';
  var T = {
    title: '장바구니',
    empty: '장바구니가 비어 있습니다.<br>제품 목록에서 마음에 드는 것을 담아보세요.',
    note: '주문하기를 누르면 구매 방법을 선택할 수 있습니다.',
    copy: '주문 목록 복사',
    ask: '주문 문의 남기기',
    go: '제품 상세 보기 →'
  };
  var custom = window.CART_TEXT;
  if (custom && typeof custom === 'object') {
    for (var k in T) { if (typeof custom[k] === 'string') T[k] = custom[k]; }
  }

  var NOLINK = '제품 상세 준비 중';
  var MAX_Q = 99;
  var INQUIRY_KEY = 'himawari-cart-inquiry';
  var CHECKOUT_KEY = 'himawari-checkout-items';

  /* ───────── 상태 ───────── */
  var cart = [];
  var selectionKey = KEY + '-unselected';
  var unselected = new Set();
  try { var storedSelection = JSON.parse(localStorage.getItem(selectionKey)); if (Array.isArray(storedSelection)) unselected = new Set(storedSelection.filter(function (key) { return typeof key === 'string'; })); } catch (error) {}
  var editor = null, optionBusy = false, optionSerial = 0, optionController = null;
  var productDisplay = new Map();
  var offerDisplay = new Map();
  var productRequest = null;
  var saleRequest = null;
  var offerExpiresAt = 0;
  var saleExpiryTimer = null;
  try {
    var raw = JSON.parse(localStorage.getItem(KEY));
    if (Object.prototype.toString.call(raw) === '[object Array]') {
      for (var i = 0; i < raw.length; i++) {
        var it = raw[i];
        if (!it || typeof it.name !== 'string') continue;
        cart.push({
          id: typeof it.id === 'string' ? it.id : '',
          name: it.name,
          price: num(it.price),
          q: Math.min(MAX_Q, Math.max(1, num(it.q) || 1)),
          url: typeof it.url === 'string' ? it.url : '',
          optionId: typeof it.optionId === 'string' ? it.optionId : '',
          optionLabel: typeof it.optionLabel === 'string' ? it.optionLabel : '',
          stock: it.stock === '' || it.stock === null || it.stock === undefined ? null : Math.max(0, num(it.stock)),
          ...(it.blackFriday != null ? { blackFriday: copySale(it.blackFriday) } : {}),
          ...(it.blackFridayUnavailable ? { blackFridayUnavailable: true } : {})
        });
      }
    }
  } catch (e) { cart = []; }

  function announceCartChange() {
    document.dispatchEvent(new CustomEvent('himawari:cart-change', { detail: { items: cart.slice() } }));
  }
  function save(announce) {
    var keys = new Set(cart.map(sku));
    unselected.forEach(function (key) { if (!keys.has(key)) unselected.delete(key); });
    try { localStorage.setItem(selectionKey, JSON.stringify(Array.from(unselected))); } catch (error) {}
    try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('himawari:cart-state', { detail: { items: cart.slice() } }));
    if (announce !== false) announceCartChange();
  }

  /* ───────── 도구 ───────── */
  function num(v) {
    var n = parseInt(String(v == null ? '' : v).replace(/[^0-9-]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }
  function won(n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; }
  function copySale(value) { return { offerId: String(value?.offerId || ''), unitPrice: Number(value?.unitPrice) || 0 }; }
  function validSale(value) { return value && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.offerId) && Number.isSafeInteger(value.unitPrice) && value.unitPrice > 0; }
  function saleBlocked(item) { return Boolean(item.blackFriday && (item.blackFridayUnavailable || !validSale(item.blackFriday) || (item.stock !== null && item.q > item.stock))); }
  var ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ENT[c]; });
  }
  /* http/https 로 시작하는 주소만 링크로 만듭니다 (javascript: 등 차단) */
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : ''; }
  function photoUrl(value) {
    if (!value) return '';
    try { var url = new URL(value, 'https://himawari.co.kr'); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
    catch (error) { return ''; }
  }
  function sku(item) { return JSON.stringify([item.id, item.optionId || '']); }
  function selectedItems() { return cart.filter(function (item) { return !unselected.has(sku(item)); }); }
  function selectionSummary() {
    return orderBenefits(selectedItems().filter(function (item) { return !saleBlocked(item); }).map(function (item) {
      var offer = offerDisplay.get(sku(item));
      return {unitPrice:item.price,quantity:item.q,campaign:Boolean(item.blackFriday && offer && offer.offerId === item.blackFriday.offerId && offer.price === item.price),regularPrice:offer?.regularPrice};
    }));
  }
  function expireSaleDisplay() {
    if (!offerExpiresAt || Date.now() < offerExpiresAt) return false;
    offerExpiresAt = 0;
    offerDisplay.clear();
    cart.forEach(function (item) { if (item.blackFriday) { item.blackFridayUnavailable = true; item.stock = 0; } });
    return true;
  }
  function scheduleSaleExpiry() {
    if (saleExpiryTimer !== null) clearTimeout(saleExpiryTimer);
    saleExpiryTimer = null;
    if (!offerExpiresAt) return;
    saleExpiryTimer = setTimeout(function () {
      saleExpiryTimer = null;
      paint();
      if (offerExpiresAt) scheduleSaleExpiry();
    }, Math.min(Math.max(0, offerExpiresAt - Date.now()), 2147483647));
  }
  function priceMarkup(item, offer) {
    if (saleBlocked(item)) return '<small>행사 상태·수량을 다시 확인해 주세요.</small>';
    var regular = offer?.regularPrice;
    var discount = item.blackFriday && offer && offer.offerId === item.blackFriday.offerId && offer.price === item.price && Number.isSafeInteger(regular) && regular > item.price;
    var current = '<strong class="rdcart__current"><span class="sr-only">' + (item.blackFriday ? '행사가 ' : '판매가 ') + '</span>' + won(item.price) + '</strong>';
    if (!discount) return '<div class="rdcart__prices">' + current + '</div>';
    var percent = Math.min(99, Math.round((regular - item.price) / regular * 100));
    return '<div class="rdcart__prices"><del class="rdcart__original"><span class="sr-only">정상가 </span>' + won(regular) + '</del><div class="rdcart__deal">' + current + '<span class="rdcart__discount">' + (percent ? percent + '%' : '1% 미만') + ' 할인</span></div></div>';
  }

  /* 담은 목록을 사람이 읽는 한 줄로 — 복사·문자·카톡 어디에나 붙여넣습니다.
     형식: 제품명 ×2, 제품명 ×1 (합계 158,000원) */
  function orderText() {
    var chosen = selectedItems();
    if (!chosen.length) return '';
    var t = 0, parts = [];
    for (var i = 0; i < chosen.length; i++) {
      t += chosen[i].q * chosen[i].price;
      parts.push(chosen[i].name + (chosen[i].optionLabel ? ' (' + chosen[i].optionLabel + ')' : '') + ' ×' + chosen[i].q);
    }
    return parts.join(', ') + ' (합계 ' + won(t) + ')';
  }

  /* ───────── DOM 만들기 ───────── */
  var btn, badge, drawer, panel, bodyEl, totalEl, checkoutBtn, copyBtn, askBtn, closeBtn;
  var lastFocus = null;
  var inerted = [];

  function setPageInert(locked) {
    if (locked) {
      inerted = [];
      for (var i = 0; i < document.body.children.length; i++) {
        var child = document.body.children[i];
        if (child === drawer) continue;
        inerted.push({
          element: child,
          inert: typeof child.inert === 'boolean' ? child.inert : false,
          ariaHidden: child.getAttribute('aria-hidden')
        });
        if ('inert' in child) child.inert = true;
        child.setAttribute('aria-hidden', 'true');
      }
      return;
    }
    for (var j = 0; j < inerted.length; j++) {
      var record = inerted[j];
      if ('inert' in record.element) record.element.inert = record.inert;
      if (record.ariaHidden === null) record.element.removeAttribute('aria-hidden');
      else record.element.setAttribute('aria-hidden', record.ariaHidden);
    }
    inerted = [];
  }

  function buildButton() {
    var found = document.querySelector('[data-cart-button]');
    if (found) {
      btn = found;
      btn.classList.add('rdcart-btn');
    } else {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rdcart-btn rdcart-btn--float';
      btn.innerHTML =
        '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
        ' stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M3 4h2l2.2 10.6a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.47-1.16L20.5 8H5.6"/>' +
        '<circle cx="9.5" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg>';
      document.body.appendChild(btn);
    }
    if (!btn.getAttribute('type')) btn.setAttribute('type', 'button');
    badge = btn.querySelector('.rdcart-btn__count');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'rdcart-btn__count';
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = '0';
      btn.appendChild(badge);
    }
    btn.addEventListener('click', function () { toggle(); });
  }

  function buildDrawer() {
    drawer = document.createElement('div');
    drawer.className = 'rdcart';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.inert = true;
    drawer.innerHTML =
      '<div class="rdcart__back" data-rdcart-close></div>' +
      '<div class="rdcart__panel" role="dialog" aria-modal="true" aria-label="' + esc(T.title) + '">' +
        '<div class="rdcart__head">' +
          '<h2 class="rdcart__title">' + esc(T.title) + '</h2>' +
          '<button class="rdcart__close" type="button" aria-label="장바구니 닫기" data-rdcart-close>&times;</button>' +
        '</div>' +
        '<div class="rdcart__toolbar"><label class="rdcart__all"><input type="checkbox" data-rdcart-select-all>전체 선택 <span class="rdcart__selected-count"></span></label><button type="button" data-rdcart-remove-selected>선택 삭제</button></div>' +
        '<div class="rdcart__editor" hidden></div><p class="rdcart__status" role="status" aria-live="polite"></p>' +
        '<div class="rdcart__body"></div>' +
        '<div class="rdcart__foot">' +
          '<div class="rdcart__benefits" hidden>이번 주문 혜택 <b class="rdcart__savings"></b></div>' +
          '<div class="rdcart__costs"><span>선택 상품금액 <b class="rdcart__subtotal"></b></span><span>배송비 <b class="rdcart__shipping"></b></span></div>' +
          '<div class="rdcart__sum"><span>합계</span><b class="rdcart__total">0원</b></div>' +
          '<div class="rdcart__shipping-state"><p></p><progress max="1" value="0" aria-label="무료배송 달성"></progress></div>' +
          '<p class="rdcart__lead">' + esc(T.note) + '</p>' +
          '<section class="rdcart__npay" data-npay-cart-section aria-label="네이버페이 주문" hidden>' +
            '<div id="npay-cart-button" class="rdcart__npay-container" data-npay-cart></div>' +
            '<p class="rdcart__npay-status" data-npay-status role="status" aria-live="polite"></p>' +
          '</section>' +
          '<div class="rdcart__acts">' +
            '<button class="rdcart__act rdcart__act--solid rdcart__checkout" type="button">장바구니 주문하기 <span aria-hidden="true">→</span></button>' +
            '<button class="rdcart__act rdcart__act--solid rdcart__copy" type="button" aria-live="polite">' + esc(T.copy) + '</button>' +
            '<button class="rdcart__act rdcart__act--ghost rdcart__ask" type="button">' + esc(T.ask) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(drawer);

    panel = drawer.querySelector('.rdcart__panel');
    bodyEl = drawer.querySelector('.rdcart__body');
    bodyEl.addEventListener('error', function (event) {
      if (event.target.classList?.contains('rdcart__photo')) {
        event.target.hidden = true;
        event.target.parentElement.classList.add('is-missing');
      }
    }, true);
    totalEl = drawer.querySelector('.rdcart__total');
    checkoutBtn = drawer.querySelector('.rdcart__checkout');
    copyBtn = drawer.querySelector('.rdcart__copy');
    askBtn = drawer.querySelector('.rdcart__ask');
    closeBtn = drawer.querySelector('.rdcart__close');

    drawer.addEventListener('click', onDrawerClick);
    drawer.addEventListener('change', onDrawerChange);
    checkoutBtn.addEventListener('click', onCheckout);
    copyBtn.addEventListener('click', onCopy);
    askBtn.addEventListener('click', onInquiry);
  }

  /* ───────── 그리기 ───────── */
  function paint() {
    if (expireSaleDisplay()) save(false);
    var chosen = selectedItems(), summary = selectionSummary();
    var count = 0, total = 0, i;
    for (i = 0; i < cart.length; i++) { count += cart[i].q; if (!saleBlocked(cart[i])) total += cart[i].q * cart[i].price; }

    if (btn) {
      btn.classList.toggle('rdcart-btn--has', count > 0);
      if (badge) badge.textContent = count;
      btn.setAttribute('aria-label', T.title + ', ' + count + '개');
      btn.setAttribute('aria-expanded', drawer && drawer.classList.contains('rdcart--open') ? 'true' : 'false');
    }
    if (!drawer) return;

    totalEl.textContent = won(summary.total);
    drawer.querySelector('.rdcart__subtotal').textContent = won(summary.subtotal);
    drawer.querySelector('.rdcart__shipping').textContent = chosen.length ? (summary.shippingFee ? won(summary.shippingFee) : '무료') : '—';
    drawer.querySelector('.rdcart__benefits').hidden = !summary.totalSavings;
    drawer.querySelector('.rdcart__savings').textContent = won(summary.totalSavings) + ' 할인';
    drawer.querySelector('.rdcart__shipping-state p').textContent = !chosen.length ? '주문할 상품을 선택해 주세요.' : summary.remaining ? won(summary.remaining) + ' 더 담으면 무료배송' : '무료배송 적용';
    drawer.querySelector('.rdcart__shipping-state progress').value = summary.progress;
    var all = drawer.querySelector('[data-rdcart-select-all]');
    all.checked = Boolean(cart.length && chosen.length === cart.length); all.indeterminate = chosen.length > 0 && chosen.length < cart.length; all.disabled = !cart.length;
    drawer.querySelector('.rdcart__selected-count').textContent = chosen.length + '/' + cart.length;
    drawer.querySelector('[data-rdcart-remove-selected]').disabled = !chosen.length;
    /* 비어 있으면 복사·문자 버튼은 눌러도 소용없으니 흐리게 (CSS 에서 처리) */
    drawer.classList.toggle('rdcart--empty', !cart.length);

    if (!cart.length) {
      /* T.empty 는 참가자가 넣는 값이라 <br> 만 허용하고 나머지는 escape 합니다. */
      bodyEl.innerHTML = '<p class="rdcart__empty">' +
        esc(T.empty).replace(/&lt;br\s*\/?&gt;/gi, '<br>') + '</p>';
    } else {
      var html = '';
      for (i = 0; i < cart.length; i++) {
        var l = cart[i];
        var display = productDisplay.get(l.id) || {};
        var offer = offerDisplay.get(sku(l));
        var image = photoUrl(offer?.image || display.image);
        var detail = l.blackFriday ? '/black-friday/item/' + encodeURIComponent(l.blackFriday.offerId) + '/' : l.id ? '/product.html?id=' + encodeURIComponent(l.id) : '';
        var go = detail
          ? '<a class="rdcart__go" href="' + esc(detail) + '">' + esc(T.go) + '</a>'
          : '<span class="rdcart__go rdcart__go--off">' + NOLINK + '</span>';
        html +=
          '<div class="rdcart__line">' +
            '<label class="rdcart__select"><input type="checkbox" data-rdcart-select="' + i + '" aria-label="' + esc(l.name) + ' 선택"' + (unselected.has(sku(l)) ? '' : ' checked') + '></label>' +
            '<' + (detail ? 'a' : 'span') + ' class="rdcart__thumb' + (image ? '' : ' is-missing') + '"' + (detail ? ' href="' + esc(detail) + '" aria-label="' + esc(l.name) + ' 상세 보기"' : '') + '>' +
              (image ? '<img class="rdcart__photo" src="' + esc(image) + '" alt="" width="72" height="88" decoding="async">' : '') + '<span class="rdcart__placeholder" aria-hidden="true">사진 준비 중</span></' + (detail ? 'a' : 'span') + '>' +
            '<div class="rdcart__grow">' +
              '<b>' + (detail ? '<a class="rdcart__name" href="' + esc(detail) + '">' + esc(l.name) + '</a>' : esc(l.name)) + '</b>' +
              (l.optionLabel ? '<em>' + esc(l.optionLabel) + '</em>' : '') +
              (l.blackFriday ? '<em class="rdcart__sale">블랙 프라이데이</em>' : '') +
              priceMarkup(l, offer) + go +
            '</div>' +
            '<div class="rdcart__controls"><button type="button" class="rdcart__option" data-rdcart-options="' + i + '"' + (optionBusy ? ' disabled' : '') + '>옵션 변경</button>' +
            '<span class="rdcart__qty">' +
              '<button type="button" data-rdcart-dec="' + i + '" aria-label="' + esc(l.name) + ' 수량 줄이기">&minus;</button>' +
              '<span>' + l.q + '</span>' +
              '<button type="button" data-rdcart-inc="' + i + '" aria-label="' + esc(l.name) + ' 수량 늘리기"' + (l.stock !== null && l.q >= l.stock ? ' disabled' : '') + '>+</button>' +
            '</span></div>' +
            '<button type="button" class="rdcart__kill" data-rdcart-kill="' + i + '" aria-label="' + esc(l.name) + ' 삭제">삭제</button>' +
          '</div>';
      }
      bodyEl.innerHTML = html;
    }

    askBtn.disabled = !chosen.length;
    copyBtn.disabled = !chosen.length;
    checkoutBtn.disabled = !chosen.length || chosen.some(saleBlocked) || optionBusy;
    drawer.querySelector('.rdcart__lead').textContent = chosen.some(saleBlocked)
      ? '행사가 종료·변경되었거나 남은 수량보다 많이 담긴 상품이 있습니다. 수량을 줄이거나 해당 상품을 다시 담아 주세요.'
      : chosen.some(function (item) { return item.blackFriday; }) ? '행사 상품 포함 · 무통장입금 또는 카카오페이로 주문할 수 있습니다.' : T.note;
  }

  /* ───────── 동작 ───────── */
  function add(name, price, url, id, optionId, optionLabel, stock, quantity, blackFriday) {
    name = String(name == null ? '' : name).trim();
    id = String(id == null ? '' : id).trim();
    optionId = String(optionId == null ? '' : optionId).trim();
    optionLabel = String(optionLabel == null ? '' : optionLabel).trim();
    stock = stock === '' || stock === null || stock === undefined ? null : Math.max(0, num(stock));
    if (blackFriday != null && !validSale(blackFriday)) return false;
    if (!name || stock === 0) return false;
    quantity = Math.min(MAX_Q, stock === null ? MAX_Q : stock, Math.max(1, Math.floor(Number(quantity) || 1)));
    var hit = null;
    var added = false;
    for (var i = 0; i < cart.length; i++) {
      if ((id && cart[i].id === id && cart[i].optionId === optionId) || (!id && cart[i].name === name)) { hit = cart[i]; break; }
    }
    if (hit) {
      var selection = blackFriday || hit.blackFriday;
      var available = !blackFriday && hit.blackFriday ? hit.stock : stock;
      if (hit.q + quantity > MAX_Q || (available !== null && hit.q + quantity > available)) return false;
      hit.q += quantity; added = true;
      hit.stock = available;
      if (selection) { hit.blackFriday = copySale(selection); hit.price = selection.unitPrice; }
      else if (price) hit.price = num(price);
      if (blackFriday) delete hit.blackFridayUnavailable;
      if (id) hit.id = id;
      if (url) hit.url = url;
    } else {
      cart.push({ id: id, name: name, price: blackFriday ? blackFriday.unitPrice : num(price), q: quantity, url: String(url || ''), optionId: optionId, optionLabel: optionLabel, stock: stock,
        ...(blackFriday ? { blackFriday: copySale(blackFriday) } : {}) });
      added = true;
    }
    if (added) { save(); paint(); refreshProductInfo(); refreshSaleItems(); }
    return added;
  }

  function onDrawerChange(event) {
    var input = event.target, index = input.getAttribute('data-rdcart-select');
    if (index !== null && cart[+index]) {
      if (input.checked) unselected.delete(sku(cart[+index])); else unselected.add(sku(cart[+index]));
      save(false); paint();
    } else if (input.hasAttribute && input.hasAttribute('data-rdcart-select-all')) {
      cart.forEach(function (item) { if (input.checked) unselected.delete(sku(item)); else unselected.add(sku(item)); });
      save(false); paint();
    }
  }
  async function optionCatalog() {
    var controller = new AbortController(); optionController = controller;
    var timer = setTimeout(function () { controller.abort(new Error('옵션 확인이 지연되고 있습니다. 다시 시도해 주세요.')); },15000);
    var aborted = new Promise(function (_,reject) { controller.signal.addEventListener('abort',function () { reject(controller.signal.reason); },{once:true}); });
    try {
      var work = (async function () {
        var responses = await Promise.all([fetch('/api/products',{cache:'no-store',signal:controller.signal}),fetch('/api/black-friday',{cache:'no-store',signal:controller.signal})]);
        if (responses.some(function (response) { return !response.ok; })) throw new Error('옵션 정보를 불러오지 못했습니다. 다시 시도해 주세요.');
        return Promise.all(responses.map(function (response) { return response.json(); }));
      })();
      var data = await Promise.race([work,aborted]);
      if (controller.signal.aborted) throw controller.signal.reason;
      (data[0].products || []).forEach(function (product) { productDisplay.set(product.id,product); });
      return {products:data[0].products || [],event:data[1]};
    } finally { clearTimeout(timer); if (optionController === controller) optionController = null; }
  }
  function cancelOptions(focus) {
    var key = editor?.key;
    ++optionSerial; optionController?.abort(); optionController = null; optionBusy = false; editor = null; showEditor(); drawer.querySelector('.rdcart__status').textContent = ''; paint();
    var index = cart.findIndex(function (item) { return sku(item) === key; });
    if (focus && index >= 0) drawer.querySelector('[data-rdcart-options="' + index + '"]')?.focus();
  }
  function showEditor(message) {
    var node = drawer.querySelector('.rdcart__editor'); node.hidden = !editor;
    if (!editor) { node.innerHTML = ''; return; }
    node.innerHTML = '<fieldset><legend>색상·옵션 변경</legend><label>변경할 옵션<select data-rdcart-choice' + (optionBusy ? ' disabled' : '') + '>' + editor.choices.map(function (choice,index) {
      return '<option value="' + index + '" data-product-id="' + esc(choice.id) + '" data-option-id="' + esc(choice.optionId) + '"' + (choice.disabled ? ' disabled' : '') + (sku(choice) === editor.key ? ' selected' : '') + '>' + esc(choice.label + ' · ' + (choice.price ? won(choice.price) : '') + (choice.reason ? ' · ' + choice.reason : '')) + '</option>';
    }).join('') + '</select></label><p>' + esc(message || '담은 수량을 유지합니다. 행사 상품은 행사 대상 옵션만 변경할 수 있습니다.') + '</p><div><button type="button" data-rdcart-apply-option' + (optionBusy ? ' disabled' : '') + '>변경 적용</button><button type="button" data-rdcart-cancel-option>취소</button></div></fieldset>';
  }
  async function openOptions(index) {
    if (optionBusy || !cart[index]) return;
    var key = sku(cart[index]), serial = ++optionSerial;
    optionBusy = true; drawer.querySelector('.rdcart__status').textContent = '최신 옵션을 확인하고 있습니다.'; paint();
    try {
      var data = await optionCatalog(), item = cart.find(function (row) { return sku(row) === key; });
      if (serial !== optionSerial || !item) return;
      editor = {key:key,choices:variantChoices(item,data.products,data.event)};
      if (!editor.choices.length) throw new Error('변경할 옵션이 없습니다. 제품 상세에서 확인해 주세요.');
      optionBusy = false; showEditor(); drawer.querySelector('[data-rdcart-choice]').focus();
      drawer.querySelector('.rdcart__status').textContent = '';
    } catch (error) { if (serial === optionSerial) { editor = null; showEditor(); drawer.querySelector('.rdcart__status').textContent = error.message; } }
    finally { if (serial === optionSerial) { optionBusy = false; paint(); } }
  }
  async function applyOption() {
    if (!editor || optionBusy) return;
    var selection = editor.choices[Number(drawer.querySelector('[data-rdcart-choice]').value)], key = editor.key, serial = ++optionSerial;
    if (!selection) return;
    optionBusy = true; showEditor(); paint();
    try {
      var data = await optionCatalog(), index = cart.findIndex(function (item) { return sku(item) === key; });
      if (serial !== optionSerial) return;
      if (index < 0) throw new Error('변경할 상품이 장바구니에 없습니다.');
      var fresh = variantChoices(cart[index],data.products,data.event).find(function (choice) { return sku(choice) === sku(selection); });
      if (!fresh || fresh.price !== selection.price || fresh.blackFriday?.offerId !== selection.blackFriday?.offerId) throw new Error('옵션 가격이나 행사 조건이 바뀌었습니다. 옵션을 다시 열어 확인해 주세요.');
      var wasSelected = !unselected.has(key), targetExisted = cart.some(function (item,i) { return i !== index && sku(item) === sku(fresh); });
      cart = replaceCartOption(cart,index,fresh,{isSelected:function (item) { return !unselected.has(sku(item)); }});
      if (wasSelected) unselected.delete(sku(fresh)); else if (!targetExisted) unselected.add(sku(fresh));
      editor = null; showEditor(); save(); drawer.querySelector('.rdcart__status').textContent = '옵션을 변경했습니다.';
      refreshSaleItems();
    } catch (error) { if (serial === optionSerial) { showEditor(error.message); drawer.querySelector('.rdcart__status').textContent = error.message; } }
    finally { if (serial === optionSerial) { optionBusy = false; if (editor) showEditor(drawer.querySelector('.rdcart__status').textContent); paint(); } }
  }
  function onDrawerClick(ev) {
    var t = ev.target;
    var hit = t.closest ? t.closest('[data-rdcart-inc],[data-rdcart-dec],[data-rdcart-kill],[data-rdcart-close],[data-rdcart-remove-selected],[data-rdcart-options],[data-rdcart-apply-option],[data-rdcart-cancel-option]') : null;
    if (!hit) return;
    if (hit.hasAttribute('data-rdcart-remove-selected')) { cancelOptions(false); cart = cart.filter(function (item) { return unselected.has(sku(item)); }); save(); paint(); return; }
    if (hit.hasAttribute('data-rdcart-options')) { openOptions(Number(hit.getAttribute('data-rdcart-options'))); return; }
    if (hit.hasAttribute('data-rdcart-apply-option')) { applyOption(); return; }
    if (hit.hasAttribute('data-rdcart-cancel-option')) { cancelOptions(true); return; }
    var d = hit.getAttribute('data-rdcart-inc');
    if (d !== null) { if (cart[+d] && cart[+d].q < MAX_Q && (cart[+d].stock === null || cart[+d].q < cart[+d].stock)) cart[+d].q++; save(); paint(); return; }
    d = hit.getAttribute('data-rdcart-dec');
    if (d !== null) {
      var l = cart[+d];
      if (l) { l.q--; if (l.q < 1) cart.splice(+d, 1); }
      save(); paint(); return;
    }
    d = hit.getAttribute('data-rdcart-kill');
    if (d !== null) { cart.splice(+d, 1); save(); paint(); return; }
    if (hit.hasAttribute('data-rdcart-close')) close();
  }

  function open() {
    if (!drawer || drawer.classList.contains('rdcart--open')) return;
    lastFocus = document.activeElement;
    drawer.inert = false;
    drawer.classList.add('rdcart--open');
    drawer.removeAttribute('aria-hidden');
    setPageInert(true);
    document.documentElement.classList.add('rdcart-locked');
    document.body.classList.add('rdcart-locked');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    try { closeBtn.focus(); } catch (e) {}
    refreshProductInfo();
    refreshSaleItems();
  }
  function refreshProductInfo() {
    if (!cart.length || typeof fetch !== 'function') return;
    if (productRequest) return productRequest;
    productRequest = (async function () {
      var response = await fetch('/api/products', { cache: 'no-store' });
      if (!response.ok) throw new Error('Product photos unavailable');
      var data = await response.json();
      (data.products || []).forEach(function (product) { productDisplay.set(product.id, product); });
      paint();
    })().catch(function () { productRequest = null; });
    return productRequest;
  }
  function refreshSaleItems() {
    if (!cart.some(function (item) { return item.blackFriday; }) || typeof fetch !== 'function') return;
    if (saleRequest) return saleRequest;
    offerDisplay.clear(); paint();
    saleRequest = (async function () {
      var response = await fetch('/api/black-friday', { cache: 'no-store' });
      if (!response.ok) return;
      var event = await response.json();
      offerExpiresAt = event.state === 'open' && Date.parse(event.endsAt) > Date.now() ? Date.parse(event.endsAt) : 0;
      scheduleSaleExpiry();
      cart.forEach(function (item) {
        if (!item.blackFriday) return;
        var sale = event.state === 'open' && Date.parse(event.endsAt) > Date.now() && (event.items || []).find(function (offer) {
          return offer.offerId === item.blackFriday.offerId && offer.productId === item.id && offer.optionId === item.optionId && offer.price === item.blackFriday.unitPrice;
        });
        item.blackFridayUnavailable = !sale || sale.remaining < 1;
        item.stock = sale ? sale.remaining : 0;
        if (sale) { item.price = sale.price; offerDisplay.set(sku(item), sale); }
      });
      save(false); paint();
    })().catch(function () { /* Checkout revalidates independently before any order is sent. */ }).finally(function () { saleRequest = null; });
    return saleRequest;
  }
  function close() {
    if (!drawer || !drawer.classList.contains('rdcart--open')) return;
    if (editor || optionBusy) cancelOptions(false);
    drawer.classList.remove('rdcart--open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.inert = true;
    setPageInert(false);
    document.documentElement.classList.remove('rdcart-locked');
    document.body.classList.remove('rdcart-locked');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
  }
  function toggle() { drawer.classList.contains('rdcart--open') ? close() : open(); }

  /* 주문 목록 복사 — 스토어에서 담을 때 보면서 담고, 문의에도 그대로 붙여넣습니다.
     clipboard API → execCommand 순서로 시도하고 실패하면 버튼에서 안내합니다. */
  function onCopy() {
    var t = orderText();
    if (!t) return;
    var was = copyBtn.textContent;
    var done = function () {
      copyBtn.textContent = '복사했습니다';
      setTimeout(function () { copyBtn.textContent = was; }, 1400);
    };
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.setAttribute('readonly', 'readonly');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) done();
      else {
        copyBtn.textContent = '복사하지 못했습니다';
        setTimeout(function () { copyBtn.textContent = was; }, 1800);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(done, fallback);
    } else { fallback(); }
  }

  /*
     수신 전화번호가 없는 sms: 링크는 특히 PC에서 무반응처럼 보입니다.
     장바구니 내용을 같은 사이트의 비공개 문의 폼으로 넘겨 모든 기기에서
     확실한 다음 동작을 제공합니다. 문자 수신번호가 확정되면 별도 문자 행동을
     추가할 수 있도록 주문 데이터는 구조화해 저장합니다.
  */
  function onInquiry() {
    if (!selectedItems().length || askBtn.disabled) return;
    var payload = {
      version: 1,
      createdAt: Date.now(),
      text: orderText(),
      items: selectedItems().map(function (item) {
        return { name: item.name, price: item.price, q: item.q, url: safeUrl(item.url) };
      })
    };
    try { sessionStorage.setItem(INQUIRY_KEY, JSON.stringify(payload)); } catch (e) {}
    askBtn.disabled = true;
    askBtn.setAttribute('aria-busy', 'true');
    askBtn.textContent = '문의서로 이동 중';
    window.location.assign('/contact.html?from=cart');
  }

  function onCheckout() {
    if (!selectedItems().length || checkoutBtn.disabled) return;
    try {
      sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify({
        version: 1,
        createdAt: Date.now(),
        items: selectedItems().filter(function (item) { return item.id; }).map(function (item) {
          return { productId: item.id, optionId: item.optionId || '', quantity: item.q, ...(item.blackFriday ? { blackFriday: copySale(item.blackFriday) } : {}) };
        })
      }));
    } catch (error) {}
    checkoutBtn.disabled = true;
    checkoutBtn.setAttribute('aria-busy', 'true');
    checkoutBtn.textContent = '주문서로 이동 중';
    window.location.assign('/checkout.html');
  }

  /* ───────── 시작 ───────── */
  function init() {
    if (document.querySelector('.rdcart')) return; /* 두 번 실행 방지 */
    buildButton();
    buildDrawer();

    import('/assets/npay.js?v=20261112-cart-convenience')
      .then(function (module) { return module.initializeNpay({ cartItems: cart.slice() }); })
      .catch(function () {});

    /* 담기 버튼은 document 위임 — 나중에 JS로 그린 카드도 그대로 잡힙니다. */
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-cart-add]') : null;
      if (!b) return;
      ev.preventDefault();
      if (b.dataset && b.dataset.rdcartBusy) return;
      var offerId = b.getAttribute('data-black-friday-offer-id');
      var added = add(b.getAttribute('data-name'), b.getAttribute('data-price'), b.getAttribute('data-url'), b.getAttribute('data-product-id'), b.getAttribute('data-option-id'), b.getAttribute('data-option-label'), b.getAttribute('data-stock'), b.getAttribute('data-quantity'), offerId ? { offerId: offerId, unitPrice: Number(b.getAttribute('data-price')) } : undefined);
      var was = b.textContent;
      var wasLabel = b.getAttribute('aria-label');
      b.dataset.rdcartBusy = '1';
      b.textContent = added ? '담았습니다' : '최대 수량입니다';
      b.setAttribute('aria-label', added ? b.getAttribute('data-name') + ' 담았습니다' : b.getAttribute('data-name') + ' 최대 수량입니다');
      b.classList.add('rdcart-added');
      if (added) {
        document.dispatchEvent(new CustomEvent('himawari:cart-added', { detail: { button: b, productId: b.getAttribute('data-product-id') || '' } }));
      }
      setTimeout(function () {
        b.textContent = was;
        if (wasLabel === null) b.removeAttribute('aria-label');
        else b.setAttribute('aria-label', wasLabel);
        b.classList.remove('rdcart-added');
        delete b.dataset.rdcartBusy;
      }, 1100);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') { close(); return; }
      /* 서랍이 열려 있는 동안 Tab 이 뒤쪽 페이지로 새지 않게 가둡니다. */
      if (e.key !== 'Tab' || !drawer.classList.contains('rdcart--open')) return;
      var f = panel.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled])');
      var list = [];
      for (var i = 0; i < f.length; i++) {
        if (f[i].offsetWidth || f[i].offsetHeight) list.push(f[i]);
      }
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (list.indexOf(document.activeElement) === -1) { e.preventDefault(); first.focus(); }
    });

    /* 다른 탭에서 담은 것도 따라오게 */
    window.addEventListener('storage', function (e) {
      if (e.key !== KEY) return;
      try { window.SiteCart.replace(JSON.parse(e.newValue) || [], false); } catch (err) { cart = []; paint(); }
      announceCartChange();
      refreshSaleItems();
    });

    paint();
    refreshProductInfo();
    refreshSaleItems();
    document.dispatchEvent(new CustomEvent('himawari:cart-ready', { detail: { items: cart.slice() } }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  /* 필요하면 콘솔·다른 스크립트에서도 쓸 수 있게 열어둡니다. */
  window.SiteCart = {
    add: add, open: open, close: close,
    items: function () { return cart.slice(); },
    selectedItems: selectedItems,
    text: orderText,
    clear: function () { cart = []; save(); paint(); },
    replace: function (items, announce) {
      cart = (Array.isArray(items) ? items : []).map(function (item) {
        return {
          id: typeof item.id === 'string' ? item.id : '',
          name: String(item.name || ''), price: num(item.price),
          q: Math.min(MAX_Q, Math.max(1, num(item.q) || 1)), url: String(item.url || ''),
          optionId: String(item.optionId || ''), optionLabel: String(item.optionLabel || ''),
          stock: item.stock === '' || item.stock === null || item.stock === undefined ? null : Math.max(0, num(item.stock)),
          ...(item.blackFriday != null ? { blackFriday: copySale(item.blackFriday) } : {}),
          ...(item.blackFridayUnavailable ? { blackFridayUnavailable: true } : {})
        };
      }).filter(function (item) { return item.name; });
      save(announce); paint(); refreshProductInfo(); refreshSaleItems();
    }
  };
})();

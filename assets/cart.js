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
(function () {
  'use strict';

  /* ───────── 설정 ───────── */
  var KEY = (typeof window.CART_KEY === 'string' && window.CART_KEY) || 'site-cart';
  var T = {
    title: '장바구니',
    empty: '장바구니가 비어 있습니다.<br>제품 목록에서 마음에 드는 것을 담아보세요.',
    note: '내부 주문서에서 배송정보를 확인합니다. PG 연결 전 주문은 결제 대기로 접수됩니다.',
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
          url: typeof it.url === 'string' ? it.url : ''
        });
      }
    }
  } catch (e) { cart = []; }

  function announceCartChange() {
    document.dispatchEvent(new CustomEvent('himawari:cart-change', { detail: { items: cart.slice() } }));
  }
  function save(announce) {
    try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {}
    if (announce !== false) announceCartChange();
  }

  /* ───────── 도구 ───────── */
  function num(v) {
    var n = parseInt(String(v == null ? '' : v).replace(/[^0-9-]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }
  function won(n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; }
  var ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ENT[c]; });
  }
  /* http/https 로 시작하는 주소만 링크로 만듭니다 (javascript: 등 차단) */
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : ''; }

  /* 담은 목록을 사람이 읽는 한 줄로 — 복사·문자·카톡 어디에나 붙여넣습니다.
     형식: 제품명 ×2, 제품명 ×1 (합계 158,000원) */
  function orderText() {
    if (!cart.length) return '';
    var t = 0, parts = [];
    for (var i = 0; i < cart.length; i++) {
      t += cart[i].q * cart[i].price;
      parts.push(cart[i].name + ' ×' + cart[i].q);
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
    drawer.innerHTML =
      '<div class="rdcart__back" data-rdcart-close></div>' +
      '<div class="rdcart__panel" role="dialog" aria-modal="true" aria-label="' + esc(T.title) + '">' +
        '<div class="rdcart__head">' +
          '<h2 class="rdcart__title">' + esc(T.title) + '</h2>' +
          '<button class="rdcart__close" type="button" aria-label="장바구니 닫기" data-rdcart-close>&times;</button>' +
        '</div>' +
        '<div class="rdcart__body"></div>' +
        '<div class="rdcart__foot">' +
          '<div class="rdcart__sum"><span>합계</span><b class="rdcart__total">0원</b></div>' +
          '<p class="rdcart__lead">' + esc(T.note) + '</p>' +
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
    totalEl = drawer.querySelector('.rdcart__total');
    checkoutBtn = drawer.querySelector('.rdcart__checkout');
    copyBtn = drawer.querySelector('.rdcart__copy');
    askBtn = drawer.querySelector('.rdcart__ask');
    closeBtn = drawer.querySelector('.rdcart__close');

    drawer.addEventListener('click', onDrawerClick);
    checkoutBtn.addEventListener('click', onCheckout);
    copyBtn.addEventListener('click', onCopy);
    askBtn.addEventListener('click', onInquiry);
  }

  /* ───────── 그리기 ───────── */
  function paint() {
    var count = 0, total = 0, i;
    for (i = 0; i < cart.length; i++) { count += cart[i].q; total += cart[i].q * cart[i].price; }

    if (btn) {
      btn.classList.toggle('rdcart-btn--has', count > 0);
      if (badge) badge.textContent = count;
      btn.setAttribute('aria-label', T.title + ', ' + count + '개');
      btn.setAttribute('aria-expanded', drawer && drawer.classList.contains('rdcart--open') ? 'true' : 'false');
    }
    if (!drawer) return;

    totalEl.textContent = won(total);
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
        var detail = l.id ? '/product.html?id=' + encodeURIComponent(l.id) : '';
        var go = detail
          ? '<a class="rdcart__go" href="' + esc(detail) + '">' + esc(T.go) + '</a>'
          : '<span class="rdcart__go rdcart__go--off">' + NOLINK + '</span>';
        html +=
          '<div class="rdcart__line">' +
            '<div class="rdcart__grow">' +
              '<b>' + esc(l.name) + '</b>' +
              '<small>' + won(l.price) + '</small>' + go +
            '</div>' +
            '<span class="rdcart__qty">' +
              '<button type="button" data-rdcart-dec="' + i + '" aria-label="' + esc(l.name) + ' 수량 줄이기">&minus;</button>' +
              '<span>' + l.q + '</span>' +
              '<button type="button" data-rdcart-inc="' + i + '" aria-label="' + esc(l.name) + ' 수량 늘리기">+</button>' +
            '</span>' +
            '<button type="button" class="rdcart__kill" data-rdcart-kill="' + i + '" aria-label="' + esc(l.name) + ' 삭제">삭제</button>' +
          '</div>';
      }
      bodyEl.innerHTML = html;
    }

    askBtn.disabled = !cart.length;
    copyBtn.disabled = !cart.length;
    checkoutBtn.disabled = !cart.length;
  }

  /* ───────── 동작 ───────── */
  function add(name, price, url, id) {
    name = String(name == null ? '' : name).trim();
    id = String(id == null ? '' : id).trim();
    if (!name) return;
    var hit = null;
    for (var i = 0; i < cart.length; i++) {
      if ((id && cart[i].id === id) || (!id && cart[i].name === name)) { hit = cart[i]; break; }
    }
    if (hit) {
      if (hit.q < MAX_Q) hit.q++;
      if (id) hit.id = id;
      if (url) hit.url = url;
      if (price) hit.price = price;
    } else {
      cart.push({ id: id, name: name, price: num(price), q: 1, url: String(url || '') });
    }
    save(); paint();
  }

  function onDrawerClick(ev) {
    var t = ev.target;
    var hit = t.closest ? t.closest('[data-rdcart-inc],[data-rdcart-dec],[data-rdcart-kill],[data-rdcart-close]') : null;
    if (!hit) return;
    var d = hit.getAttribute('data-rdcart-inc');
    if (d !== null) { if (cart[+d] && cart[+d].q < MAX_Q) cart[+d].q++; save(); paint(); return; }
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
    drawer.classList.add('rdcart--open');
    drawer.removeAttribute('aria-hidden');
    setPageInert(true);
    document.documentElement.classList.add('rdcart-locked');
    document.body.classList.add('rdcart-locked');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    try { closeBtn.focus(); } catch (e) {}
  }
  function close() {
    if (!drawer || !drawer.classList.contains('rdcart--open')) return;
    drawer.classList.remove('rdcart--open');
    drawer.setAttribute('aria-hidden', 'true');
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
    if (!cart.length || askBtn.disabled) return;
    var payload = {
      version: 1,
      createdAt: Date.now(),
      text: orderText(),
      items: cart.map(function (item) {
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
    if (!cart.length || checkoutBtn.disabled) return;
    try {
      sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify({
        version: 1,
        createdAt: Date.now(),
        items: cart.filter(function (item) { return item.id; }).map(function (item) {
          return { productId: item.id, quantity: item.q };
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

    /* 담기 버튼은 document 위임 — 나중에 JS로 그린 카드도 그대로 잡힙니다. */
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-cart-add]') : null;
      if (!b) return;
      ev.preventDefault();
      add(b.getAttribute('data-name'), b.getAttribute('data-price'), b.getAttribute('data-url'), b.getAttribute('data-product-id'));
      if (b.dataset && b.dataset.rdcartBusy) return;
      var was = b.textContent;
      var wasLabel = b.getAttribute('aria-label');
      b.dataset.rdcartBusy = '1';
      b.textContent = '담았습니다';
      b.setAttribute('aria-label', b.getAttribute('data-name') + ' 담았습니다');
      b.classList.add('rdcart-added');
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
      var f = panel.querySelectorAll('a[href],button:not([disabled])');
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
      try { cart = JSON.parse(e.newValue) || []; } catch (err) { cart = []; }
      paint();
    });

    paint();
    document.dispatchEvent(new CustomEvent('himawari:cart-ready', { detail: { items: cart.slice() } }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  /* 필요하면 콘솔·다른 스크립트에서도 쓸 수 있게 열어둡니다. */
  window.SiteCart = {
    add: add, open: open, close: close,
    items: function () { return cart.slice(); },
    text: orderText,
    clear: function () { cart = []; save(); paint(); },
    replace: function (items, announce) {
      cart = (Array.isArray(items) ? items : []).map(function (item) {
        return {
          id: typeof item.id === 'string' ? item.id : '',
          name: String(item.name || ''), price: num(item.price),
          q: Math.min(MAX_Q, Math.max(1, num(item.q) || 1)), url: String(item.url || '')
        };
      }).filter(function (item) { return item.name; });
      save(announce); paint();
    }
  };
})();

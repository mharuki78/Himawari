(function () {
  'use strict';

  var WISHLIST_KEY = 'himawari-wishlist';
  var CART_OWNER_KEY = 'himawari-cart-owner';
  var state = { ready: false, authenticated: false, user: null, providers: {}, wishlist: new Set(), wishlistItems: [] };
  var dialog, dialogStatus, signedOut, signedIn, profileName, profileEmail, accountCount;
  var cartSyncReady = false;
  var cartSyncTimer = 0;

  var STORE_LINKS = [
    { name: '네이버 스마트스토어', url: 'https://smartstore.naver.com/baegot', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#03c75a" d="M3 3h6l6 9V3h6v18h-6l-6-9v9H3z"/></svg>' },
    { name: '쿠팡', url: 'https://shop.coupang.com/A01305526/468030?platform=p&source=brandstore_sdp_atf_topbadge&pid=8645626896&viid=92097411930&brandId=0', icon: '<img src="/assets/channel-logos/coupang.png" alt="">' },
    { name: '무신사', url: 'https://www.musinsa.com/brand/himawari?gf=A', icon: '<img src="/assets/channel-logos/musinsa.svg" alt="">' }
  ];

  function storeLink(store, footer) {
    var link = document.createElement('a');
    link.href = store.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = footer ? 'footer-store-link' : 'store-picker__link';
    link.setAttribute('aria-label', store.name + ' himawarikorea — 새 탭에서 열림');
    link.innerHTML = '<span class="store-brand-logo">' + store.icon + '</span><span>' + (footer ? 'himawarikorea' : store.name) + '</span><span aria-hidden="true">↗</span>';
    return link;
  }

  function buildStoreLinks() {
    document.querySelectorAll('.header-store').forEach(function (original, index) {
      var wrapper = document.createElement('div');
      wrapper.className = 'store-picker';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = original.className;
      button.textContent = '스토어 ⌄';
      button.setAttribute('aria-expanded', 'false');
      var panel = document.createElement('nav');
      panel.id = 'store-picker-' + index;
      panel.className = 'store-picker__panel';
      panel.setAttribute('aria-label', '공식 스토어 선택');
      panel.hidden = true;
      button.setAttribute('aria-controls', panel.id);
      STORE_LINKS.forEach(function (store) { panel.appendChild(storeLink(store, false)); });
      function close() { panel.hidden = true; button.setAttribute('aria-expanded', 'false'); }
      button.addEventListener('click', function () {
        panel.hidden = !panel.hidden;
        button.setAttribute('aria-expanded', String(!panel.hidden));
      });
      wrapper.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { close(); button.focus(); }
      });
      wrapper.addEventListener('focusout', function (event) { if (!wrapper.contains(event.relatedTarget)) close(); });
      document.addEventListener('click', function (event) { if (!wrapper.contains(event.target)) close(); });
      original.replaceWith(wrapper);
      wrapper.append(button, panel);
    });
    document.querySelectorAll('.footer-contact').forEach(function (group) {
      STORE_LINKS.forEach(function (store) { group.appendChild(storeLink(store, true)); });
    });
  }

  var SOCIAL_LINKS = {
    instagram: {
      label: '@himawari.korea',
      url: 'https://www.instagram.com/himawari.korea/',
      icon: '<svg class="footer-social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5.25"></rect><circle cx="12" cy="12" r="4.15"></circle><circle class="footer-social-icon__dot" cx="17.45" cy="6.75" r="1.05"></circle></svg>'
    },
    youtube: {
      label: '@himawarikorea',
      url: 'https://www.youtube.com/@himawarikorea',
      icon: '<svg class="footer-social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21.3 7.05a2.9 2.9 0 0 0-2.04-2.06C17.46 4.5 12 4.5 12 4.5s-5.46 0-7.26.49A2.9 2.9 0 0 0 2.7 7.05 30.3 30.3 0 0 0 2.2 12c0 1.67.17 3.32.5 4.95a2.9 2.9 0 0 0 2.04 2.06c1.8.49 7.26.49 7.26.49s5.46 0 7.26-.49a2.9 2.9 0 0 0 2.04-2.06c.33-1.63.5-3.28.5-4.95s-.17-3.32-.5-4.95Z"></path><path class="footer-social-icon__play" d="m9.75 15.25 5.6-3.25-5.6-3.25v6.5Z"></path></svg>'
    }
  };

  function decorateSocialLink(link, network) {
    var social = SOCIAL_LINKS[network];
    if (!link || link.dataset.socialIcon === network) return;
    link.classList.add('footer-social-link', 'footer-social-link--' + network);
    link.dataset.socialIcon = network;
    link.setAttribute('aria-label', network === 'instagram' ? 'Himawari 인스타그램 — 새 탭에서 열림' : 'Himawari 유튜브 — 새 탭에서 열림');
    link.innerHTML = social.icon + '<span>' + social.label + '</span>';
  }

  function buildFooterSocialLinks() {
    document.querySelectorAll('.footer-contact').forEach(function (group) {
      var instagram = group.querySelector('a[href*="instagram.com"]');
      decorateSocialLink(instagram, 'instagram');

      var youtube = group.querySelector('a[href*="youtube.com/@himawarikorea"]');
      if (!youtube) {
        youtube = document.createElement('a');
        youtube.href = SOCIAL_LINKS.youtube.url;
        youtube.target = '_blank';
        youtube.rel = 'noopener noreferrer';
        group.appendChild(youtube);
      }
      decorateSocialLink(youtube, 'youtube');
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function safeImage(value) {
    try {
      var url = new URL(value);
      return url.protocol === 'https:' ? url.href : '';
    } catch (error) { return ''; }
  }

  function currentReturnTo() {
    var url = new URL(location.href);
    url.searchParams.delete('auth');
    return url.pathname + url.search + url.hash;
  }

  async function request(url, options) {
    var response = await fetch(url, Object.assign({ cache: 'no-store' }, options || {}));
    var body = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var error = new Error(body.message || '요청을 완료하지 못했습니다.');
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function loadWishlist() {
    try {
      var values = JSON.parse(localStorage.getItem(WISHLIST_KEY));
      return new Set(Array.isArray(values) ? values.map(String).filter(Boolean) : []);
    } catch (error) { return new Set(); }
  }

  function saveWishlist() {
    try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(Array.from(state.wishlist))); } catch (error) {}
  }

  function showToast(message) {
    var toast = document.querySelector('[data-member-toast]');
    if (!toast) {
      toast = document.createElement('p');
      toast.className = 'member-toast';
      toast.dataset.memberToast = '';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () { toast.classList.remove('is-visible'); }, 2800);
  }

  function providerHref(provider) {
    return '/api/auth/start?provider=' + encodeURIComponent(provider) + '&returnTo=' + encodeURIComponent(currentReturnTo());
  }

  function buildHeaderActions() {
    document.querySelectorAll('.site-header, .about-header').forEach(function (header) {
      if (header.querySelector('[data-member-open]')) return;
      var store = header.querySelector('.header-store');
      if (!store) return;
      var wrap = document.createElement('div');
      wrap.className = 'header-actions';
      var trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'member-trigger';
      trigger.dataset.memberOpen = '';
      trigger.textContent = '로그인';
      trigger.setAttribute('aria-haspopup', 'dialog');
      store.replaceWith(wrap);
      wrap.append(trigger, store);

      var nav = header.querySelector('.site-nav');
      if (nav) {
        var mobileTrigger = document.createElement('button');
        mobileTrigger.type = 'button';
        mobileTrigger.className = 'member-nav-trigger';
        mobileTrigger.dataset.memberOpen = '';
        mobileTrigger.textContent = '로그인 · 관심상품';
        mobileTrigger.setAttribute('aria-haspopup', 'dialog');
        nav.appendChild(mobileTrigger);
      }
    });
  }

  function buildDialog() {
    dialog = document.createElement('dialog');
    dialog.className = 'member-dialog';
    dialog.setAttribute('aria-labelledby', 'member-dialog-title');
    dialog.innerHTML =
      '<div class="member-panel">' +
        '<header><div><p>Himawari member</p><h2 id="member-dialog-title">내 가방 목록</h2></div>' +
          '<button type="button" data-member-close aria-label="회원 창 닫기">닫기</button></header>' +
        '<p class="member-dialog-status" data-member-dialog-status role="status" aria-live="polite"></p>' +
        '<section class="member-signed-out" data-member-signed-out>' +
          '<p>간편 로그인하면 장바구니와 관심상품을 다른 방문에도 이어서 볼 수 있습니다.</p>' +
          '<div class="member-provider-list">' +
            '<a class="member-provider member-provider--naver" data-provider="naver"><strong>NAVER</strong><span>네이버로 계속하기</span><b aria-hidden="true">→</b></a>' +
            '<a class="member-provider member-provider--google" data-provider="google"><strong>GOOGLE</strong><span>Google로 계속하기</span><b aria-hidden="true">→</b></a>' +
          '</div>' +
          '<small>로그인을 계속하면 <a href="/privacy.html">개인정보 처리 안내</a>를 확인한 것으로 봅니다. Himawari가 별도 비밀번호를 저장하지 않습니다.</small>' +
        '</section>' +
        '<section class="member-signed-in" data-member-signed-in hidden>' +
          '<div class="member-profile"><span class="member-profile-image" data-profile-image aria-hidden="true">H</span>' +
            '<div><strong data-profile-name>Himawari 회원</strong><small data-profile-email></small></div></div>' +
          '<a class="member-account-link" href="/account.html"><span>관심상품과 계정 관리</span><b data-account-count>0개</b><i aria-hidden="true">→</i></a>' +
          '<button class="member-logout" type="button" data-member-logout>로그아웃</button>' +
        '</section>' +
      '</div>';
    document.body.appendChild(dialog);
    dialogStatus = dialog.querySelector('[data-member-dialog-status]');
    signedOut = dialog.querySelector('[data-member-signed-out]');
    signedIn = dialog.querySelector('[data-member-signed-in]');
    profileName = dialog.querySelector('[data-profile-name]');
    profileEmail = dialog.querySelector('[data-profile-email]');
    accountCount = dialog.querySelector('[data-account-count]');
    dialog.querySelector('[data-member-close]').addEventListener('click', closeDialog);
    dialog.querySelector('[data-member-logout]').addEventListener('click', logout);
    dialog.addEventListener('click', function (event) { if (event.target === dialog) closeDialog(); });
  }

  function openDialog() {
    renderMemberState();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeDialog() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  function renderMemberState() {
    document.querySelectorAll('.member-trigger').forEach(function (button) {
      button.textContent = state.authenticated ? 'MY' : '로그인';
      button.setAttribute('aria-label', state.authenticated ? '회원 메뉴 열기' : '로그인 메뉴 열기');
    });
    document.querySelectorAll('.member-nav-trigger').forEach(function (button) {
      button.textContent = state.authenticated ? '마이페이지 · 관심상품 ' + state.wishlist.size + '개' : '로그인 · 관심상품';
    });
    signedOut.hidden = state.authenticated;
    signedIn.hidden = !state.authenticated;
    if (state.authenticated && state.user) {
      profileName.textContent = state.user.displayName || 'Himawari 회원';
      profileEmail.textContent = state.user.email || (state.user.provider === 'naver' ? '네이버 로그인' : 'Google 로그인');
      accountCount.textContent = state.wishlist.size + '개';
      var profileImage = dialog.querySelector('[data-profile-image]');
      var image = safeImage(state.user.avatarUrl);
      profileImage.textContent = image ? '' : (state.user.displayName || 'H').slice(0, 1);
      profileImage.style.backgroundImage = image ? 'url("' + image.replace(/"/g, '') + '")' : '';
    }
    dialog.querySelectorAll('[data-provider]').forEach(function (link) {
      var provider = link.dataset.provider;
      var enabled = state.providers[provider] === true;
      link.href = enabled ? providerHref(provider) : '#';
      link.classList.toggle('is-disabled', !enabled);
      link.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    });
    refreshWishlistButtons();
  }

  function refreshWishlistButtons() {
    document.querySelectorAll('[data-wishlist-toggle][data-product-id]').forEach(function (button) {
      var selected = state.wishlist.has(button.dataset.productId);
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      var label = button.querySelector('[data-wishlist-label]');
      if (label) label.textContent = selected ? '관심상품 저장됨' : '관심상품 저장';
    });
    if (accountCount) accountCount.textContent = state.wishlist.size + '개';
  }

  async function syncWishlist() {
    if (!state.authenticated) return;
    try {
      var result = await request('/api/member/wishlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: Array.from(state.wishlist) }),
      });
      state.wishlistItems = result.items || [];
      renderAccountWishlist();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function toggleWishlist(button) {
    var id = button.dataset.productId;
    if (!id) return;
    if (state.wishlist.has(id)) state.wishlist.delete(id);
    else state.wishlist.add(id);
    saveWishlist();
    refreshWishlistButtons();
    if (state.authenticated) await syncWishlist();
    else showToast('저장했습니다. 로그인하면 계정에도 이어서 보관됩니다.');
  }

  function cartItemsForServer() {
    if (!window.SiteCart) return [];
    return window.SiteCart.items().filter(function (item) { return item.id; }).map(function (item) {
      return { productId: item.id, optionId: item.optionId || '', quantity: Math.min(99, Math.max(1, Number(item.q) || 1)) };
    });
  }

  async function sendCart() {
    if (!state.authenticated || !window.SiteCart || !cartSyncReady) return;
    try {
      await request('/api/member/cart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cartItemsForServer() }),
      });
    } catch (error) {
      showToast('장바구니 계정 저장을 잠시 후 다시 시도합니다.');
    }
  }

  function queueCartSync() {
    clearTimeout(cartSyncTimer);
    cartSyncTimer = setTimeout(sendCart, 350);
  }

  async function mergeMemberCart() {
    if (!state.authenticated || !window.SiteCart) return;
    try {
      var result = await request('/api/member/cart');
      var serverItems = Array.isArray(result.items) ? result.items : [];
      var localItems = window.SiteCart.items();
      var sameOwner = false;
      try { sameOwner = localStorage.getItem(CART_OWNER_KEY) === state.user.id; } catch (error) {}
      var merged = new Map();
      serverItems.forEach(function (item) {
        var product = item.product || {};
        var cartKey = item.productId + '::' + (item.optionId || '');
        merged.set(cartKey, {
          id: item.productId, name: product.name, price: product.price,
          q: item.quantity, url: product.url || '', optionId: item.optionId || '',
          optionLabel: item.optionLabel || '', stock: item.stock
        });
      });
      localItems.forEach(function (item) {
        if (!item.id) return;
        var cartKey = item.id + '::' + (item.optionId || '');
        if (!merged.has(cartKey)) merged.set(cartKey, item);
        else if (!sameOwner) {
          var existing = merged.get(cartKey);
          existing.q = Math.min(99, (Number(existing.q) || 1) + (Number(item.q) || 1));
        }
      });
      var legacy = localItems.filter(function (item) { return !item.id; });
      window.SiteCart.replace(legacy.concat(Array.from(merged.values())), false);
      cartSyncReady = true;
      await sendCart();
      try { localStorage.setItem(CART_OWNER_KEY, state.user.id); } catch (error) {}
    } catch (error) {
      cartSyncReady = true;
      showToast('계정 장바구니를 불러오지 못했습니다. 현재 기기의 목록은 유지됩니다.');
    }
  }

  async function waitForCartAndMerge() {
    if (window.SiteCart) return mergeMemberCart();
    await new Promise(function (resolve) {
      var timer = setTimeout(resolve, 1500);
      document.addEventListener('himawari:cart-ready', function ready() {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
    if (window.SiteCart) await mergeMemberCart();
  }

  function productCard(item) {
    var product = item.product || {};
    var image = safeImage(product.image);
    var article = document.createElement('article');
    article.className = 'account-product';
    var cartAction = (product.options || []).length
      ? '<a href="/product.html?id=' + encodeURIComponent(item.productId) + '#product-options">옵션 선택</a>'
      : '<button type="button" data-cart-add data-product-id="' + escapeHtml(item.productId) + '" data-name="' + escapeHtml(product.name) + '" data-price="' + Number(product.price || 0) + '" data-stock="' + (product.stock === null || product.stock === undefined ? '' : Number(product.stock)) + '" data-url="' + escapeHtml(product.url || '') + '"' + (product.soldOut ? ' disabled' : '') + '>' + (product.soldOut ? '품절' : '장바구니 담기') + '</button>';
    article.innerHTML =
      '<a class="account-product__media" href="/product.html?id=' + encodeURIComponent(item.productId) + '">' +
        (image ? '<img src="' + escapeHtml(image) + '" alt="" loading="lazy">' : '<span>이미지 준비 중</span>') + '</a>' +
      '<div><p>' + escapeHtml(product.model || 'Himawari') + '</p><h3><a href="/product.html?id=' + encodeURIComponent(item.productId) + '">' + escapeHtml(product.name || '제품') + '</a></h3>' +
      '<div class="account-product__actions">' + cartAction +
      '<button type="button" data-wishlist-toggle data-product-id="' + escapeHtml(item.productId) + '"><span data-wishlist-label>관심상품 저장됨</span></button></div></div>';
    return article;
  }

  function renderAccountWishlist() {
    var page = document.querySelector('[data-account-page]');
    if (!page) return;
    var signedOutPanel = page.querySelector('[data-account-signed-out]');
    var signedInPanel = page.querySelector('[data-account-signed-in]');
    signedOutPanel.hidden = state.authenticated;
    signedInPanel.hidden = !state.authenticated;
    if (!state.authenticated) return;
    page.querySelector('[data-account-name]').textContent = state.user.displayName || 'Himawari 회원';
    page.querySelector('[data-account-email]').textContent = state.user.email || '간편 로그인 계정';
    var list = page.querySelector('[data-account-wishlist]');
    if (!state.wishlistItems.length) {
      list.innerHTML = '<p class="account-empty">아직 저장한 관심상품이 없습니다.<br><a href="/products.html">전체 제품을 살펴보세요 →</a></p>';
    } else {
      list.replaceChildren.apply(list, state.wishlistItems.map(productCard));
    }
    refreshWishlistButtons();
  }

  async function loadMemberData() {
    state.wishlist = loadWishlist();
    try {
      var session = await request('/api/auth/session');
      state.authenticated = session.authenticated === true;
      state.user = session.user || null;
      state.providers = session.providers || {};
      if (state.authenticated) {
        var remote = await request('/api/member/wishlist');
        (remote.items || []).forEach(function (item) { state.wishlist.add(item.productId); });
        saveWishlist();
        await syncWishlist();
        await waitForCartAndMerge();
      }
    } catch (error) {
      state.providers = state.providers || {};
      dialogStatus.textContent = error.status === 503 ? '회원 기능을 준비하고 있습니다.' : '';
    }
    state.ready = true;
    renderMemberState();
    renderAccountWishlist();
    document.dispatchEvent(new CustomEvent('himawari:member-ready', { detail: { authenticated: state.authenticated } }));
  }

  async function logout() {
    var button = dialog.querySelector('[data-member-logout]');
    button.disabled = true;
    dialogStatus.textContent = '로그아웃 중입니다.';
    try {
      await request('/api/auth/logout', { method: 'POST' });
      state.authenticated = false;
      state.user = null;
      state.wishlist = new Set();
      state.wishlistItems = [];
      saveWishlist();
      if (window.SiteCart) window.SiteCart.replace([], false);
      try { localStorage.removeItem(CART_OWNER_KEY); } catch (error) {}
      cartSyncReady = false;
      dialogStatus.textContent = '안전하게 로그아웃했습니다.';
      renderMemberState();
      renderAccountWishlist();
    } catch (error) { dialogStatus.textContent = error.message; }
    button.disabled = false;
  }

  function bindAccountDeletion() {
    var form = document.querySelector('[data-delete-account]');
    if (!form) return;
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var status = form.querySelector('[data-delete-status]');
      var button = form.querySelector('button[type="submit"]');
      var confirmation = new FormData(form).get('confirmation');
      button.disabled = true;
      status.textContent = '회원 정보를 삭제하고 있습니다.';
      try {
        await request('/api/member/account', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmation: confirmation }),
        });
        state.authenticated = false;
        state.user = null;
        state.wishlist = new Set();
        state.wishlistItems = [];
        saveWishlist();
        if (window.SiteCart) window.SiteCart.replace([], false);
        try { localStorage.removeItem(CART_OWNER_KEY); } catch (error) {}
        status.textContent = '회원탈퇴가 완료되었습니다. 저장된 회원 데이터가 삭제되었습니다.';
        form.reset();
        renderMemberState();
        renderAccountWishlist();
      } catch (error) { status.textContent = error.message; }
      button.disabled = false;
    });
  }

  function handleAuthStatus() {
    var url = new URL(location.href);
    var status = url.searchParams.get('auth');
    if (!status) return;
    var messages = {
      success: '로그인이 완료되었습니다.', cancelled: '로그인을 취소했습니다.',
      failed: '로그인을 완료하지 못했습니다. 다시 시도해 주세요.',
      'state-error': '로그인 확인 시간이 지났습니다. 다시 시도해 주세요.',
      'provider-unavailable': '해당 간편 로그인을 준비하고 있습니다.',
      'callback-error': '로그인 응답을 확인하지 못했습니다. 다시 시도해 주세요.'
    };
    showToast(messages[status] || '로그인 상태를 확인해 주세요.');
    url.searchParams.delete('auth');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  function init() {
    buildFooterSocialLinks();
    buildHeaderActions();
    buildStoreLinks();
    buildDialog();
    bindAccountDeletion();
    document.addEventListener('click', function (event) {
      var open = event.target.closest && event.target.closest('[data-member-open]');
      if (open) { event.preventDefault(); openDialog(); return; }
      var wishlist = event.target.closest && event.target.closest('[data-wishlist-toggle]');
      if (wishlist) { event.preventDefault(); toggleWishlist(wishlist); }
      var disabledProvider = event.target.closest && event.target.closest('.member-provider.is-disabled');
      if (disabledProvider) { event.preventDefault(); dialogStatus.textContent = '이 로그인 수단은 아직 설정되지 않았습니다.'; }
    });
    document.addEventListener('himawari:cart-change', queueCartSync);
    handleAuthStatus();
    loadMemberData();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.HimawariMember = {
    open: openDialog,
    session: function () { return { authenticated: state.authenticated, user: state.user }; },
    wishlist: function () { return Array.from(state.wishlist); },
  };
})();

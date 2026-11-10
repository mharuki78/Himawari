(function () {
  'use strict';
  var dialog = document.querySelector('[data-promotion-dialog]');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  var close = dialog.querySelector('[data-promotion-close]');
  var link = dialog.querySelector('[data-promotion-link]');
  var storageKey = '';
  var campaign = document.querySelector('[data-black-friday-popup]');
  var campaignClose = campaign.querySelector('[data-promotion-close]');
  var artwork = campaign.querySelector('[data-black-friday-artwork]');
  var artworkTemplate = campaign.querySelector('[data-black-friday-template]');
  var campaignKey = '';
  var defaultRequested = false;
  var welcome = document.querySelector('[data-welcome-popup]');
  var welcomeKey = 'himawari-welcome-coupon-v1:dismissed';
  var welcomeClose = welcome.querySelector('[data-welcome-close]');
  var welcomeMotion = matchMedia('(prefers-reduced-motion: reduce)');
  var welcomeAnimation;

  function remember(key) {
    if (!key) return;
    try { localStorage.setItem(key, 'dismissed'); } catch (error) {}
  }

  function wasDismissed(key) {
    try { return localStorage.getItem(key) === 'dismissed'; } catch (error) { return false; }
  }

  close.addEventListener('click', function () { remember(storageKey); dialog.close(); });
  link.addEventListener('click', function () { remember(storageKey); });
  dialog.addEventListener('cancel', function () { remember(storageKey); });
  campaignClose.addEventListener('click', function () { remember(campaignKey); campaign.close(); });
  campaign.addEventListener('cancel', function () { remember(campaignKey); });
  artwork.addEventListener('click', function (event) {
    if (event.target.closest('a')) remember(campaignKey);
  });
  welcomeClose.addEventListener('click', function () { remember(welcomeKey); welcome.close(); });
  welcome.querySelector('[data-member-open]').addEventListener('click', function () { remember(welcomeKey); welcome.close(); });
  welcome.addEventListener('cancel', function () { remember(welcomeKey); });
  function stopWelcomeMotion() { welcomeAnimation?.revert(); welcomeAnimation = null; }
  welcome.addEventListener('close', stopWelcomeMotion);
  welcomeMotion.addEventListener('change', stopWelcomeMotion);

  function request(url) {
    return fetch(url, { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error();
      return response.json();
    });
  }

  function showDefaultPopup() {
    if (defaultRequested) return;
    defaultRequested = true;
    Promise.all([
      request('/api/promotions').catch(function () { return {}; }),
      wasDismissed(welcomeKey) ? null : request('/api/auth/session').catch(function () { return null; })
    ]).then(function ([payload, session]) {
        if ((campaignKey && !wasDismissed(campaignKey)) || document.querySelector('dialog[open]')) return;
        if (session?.configured && !session.authenticated && Object.values(session.providers || {}).includes(true)) {
          welcome.showModal();
          welcomeClose.focus();
          if (!welcomeMotion.matches) {
            import('/assets/site-ui.js').then(function ({ animate }) {
              if (welcome.open && !welcomeMotion.matches) welcomeAnimation = animate(welcome.querySelector('.home-welcome__ticket'), { translateY: [7, 0], duration: 250, ease: 'out(3)' });
            }).catch(function () {});
          }
          return;
        }
        var popup = payload.popup || {};
        if (!popup.enabled || !payload.updatedAt) return;
        storageKey = 'himawari-promotion-dismissed:' + payload.updatedAt;
        if (wasDismissed(storageKey)) return;
        dialog.querySelector('[data-promotion-title]').textContent = popup.title || '';
        dialog.querySelector('[data-promotion-message]').textContent = popup.message || '';
        link.href = popup.linkUrl || '/products.html';
        dialog.querySelector('[data-promotion-link-label]').textContent = popup.linkLabel || '제품 보러가기';
        dialog.showModal();
        close.focus();
      })
      .catch(function () {});
  }

  document.addEventListener('himawari:black-friday-status', function (event) {
    var sale = event.detail;
    if (sale?.state !== 'open') {
      campaignKey = '';
      if (campaign.open) campaign.close();
      artwork.replaceChildren();
      showDefaultPopup();
      return;
    }

    var key = 'himawari-black-friday-dismissed:' + sale.startsAt + ':' + sale.endsAt;
    if (campaignKey === key) return;
    campaignKey = key;
    if (campaign.open) campaign.close();
    if (dialog.open) dialog.close();
    if (welcome.open) welcome.close();
    if (wasDismissed(key)) { showDefaultPopup(); return; }

    artwork.replaceChildren(artworkTemplate.content.cloneNode(true));
    artwork.querySelector('img').decode().then(function () {
      if (campaignKey !== key || wasDismissed(key)) return;
      campaign.showModal();
      campaignClose.focus();
    }).catch(function () {});
  });
})();

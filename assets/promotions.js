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

  function showDefaultPopup() {
    if (defaultRequested) return;
    defaultRequested = true;
    fetch('/api/promotions', { cache: 'no-store' })
      .then(function (response) { if (!response.ok) throw new Error(); return response.json(); })
      .then(function (payload) {
        var popup = payload.popup || {};
        if (campaignKey || !popup.enabled || !payload.updatedAt) return;
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
    if (wasDismissed(key)) return;

    artwork.replaceChildren(artworkTemplate.content.cloneNode(true));
    artwork.querySelector('img').decode().then(function () {
      if (campaignKey !== key || wasDismissed(key)) return;
      campaign.showModal();
      campaignClose.focus();
    }).catch(function () {});
  });
})();

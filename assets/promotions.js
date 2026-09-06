(function () {
  'use strict';
  var dialog = document.querySelector('[data-promotion-dialog]');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  var close = dialog.querySelector('[data-promotion-close]');
  var link = dialog.querySelector('[data-promotion-link]');
  var storageKey = '';

  function remember() {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, 'dismissed'); } catch (error) {}
  }

  function dismiss() { remember(); if (dialog.open) dialog.close(); }
  close.addEventListener('click', dismiss);
  link.addEventListener('click', remember);
  dialog.addEventListener('cancel', remember);

  fetch('/api/promotions', { cache: 'no-store' })
    .then(function (response) { if (!response.ok) throw new Error(); return response.json(); })
    .then(function (payload) {
      var popup = payload.popup || {};
      if (!popup.enabled || !payload.updatedAt) return;
      storageKey = 'himawari-promotion-dismissed:' + payload.updatedAt;
      try { if (localStorage.getItem(storageKey) === 'dismissed') return; } catch (error) {}
      dialog.querySelector('[data-promotion-title]').textContent = popup.title || '';
      dialog.querySelector('[data-promotion-message]').textContent = popup.message || '';
      link.href = popup.linkUrl || '/products.html';
      dialog.querySelector('[data-promotion-link-label]').textContent = popup.linkLabel || '제품 보러가기';
      dialog.showModal();
      close.focus();
    })
    .catch(function () {});
})();

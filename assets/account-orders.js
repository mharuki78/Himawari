(function () {
  'use strict';

  var root = document.querySelector('[data-account-orders]');
  if (!root) return;
  var list = root.querySelector('[data-account-order-list]');
  var status = root.querySelector('[data-account-orders-status]');
  var pagination = root.querySelector('[data-account-order-pagination]');
  var previous = root.querySelector('[data-order-previous]');
  var next = root.querySelector('[data-order-next]');
  var dialog = document.querySelector('[data-order-request-dialog]');
  var dialogTitle = dialog.querySelector('[data-order-request-title]');
  var dialogDescription = dialog.querySelector('[data-order-request-description]');
  var dialogError = dialog.querySelector('[data-order-request-error]');
  var dialogCancel = dialog.querySelector('[data-order-request-cancel]');
  var dialogConfirm = dialog.querySelector('[data-order-request-confirm]');
  var dialogLabel = dialog.querySelector('[data-order-request-label]');
  var priceFormatter = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 });
  var dateFormatter = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  var page = 1;
  var total = 0;
  var pageSize = 20;
  var controller;
  var requestTarget = null;

  function request(url, options) {
    return fetch(url, Object.assign({ cache: 'no-store' }, options || {})).then(async function (response) {
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        var error = new Error(payload.message || '주문 요청을 처리하지 못했습니다.');
        error.status = response.status;
        throw error;
      }
      return payload;
    });
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderOrder(order) {
    var article = element('article', 'account-order');
    var header = document.createElement('header');
    var identity = document.createElement('div');
    identity.append(element('p', '', dateFormatter.format(new Date(order.createdAt))), element('h3', '', order.orderNumber));
    var badge = element('span', 'order-status', order.statusLabel);
    badge.dataset.status = order.status;
    header.append(identity, badge);

    var items = element('div', 'account-order__items');
    order.items.forEach(function (item) {
      var row = element('div', 'account-order__item');
      row.append(element('strong', '', item.name + ' × ' + item.quantity), element('span', '', priceFormatter.format(item.lineTotal)));
      items.append(row);
    });
    var summary = element('div', 'account-order__summary');
    summary.append(element('span', '', order.shippingFee ? '배송비 포함' : '무료배송'), element('strong', '', priceFormatter.format(order.total)));

    var details = document.createElement('details');
    details.append(element('summary', '', '배송정보와 처리 내역 보기'));
    var detailBody = element('div', 'account-order__details');
    var definition = document.createElement('dl');
    var values = [
      ['받는 분', order.recipient.name],
      ['연락처', order.recipient.phone],
      ['이메일', order.recipient.email],
      ['배송지', '(' + order.recipient.postalCode + ') ' + order.recipient.addressLine1 + (order.recipient.addressLine2 ? ' ' + order.recipient.addressLine2 : '')],
      ['배송 요청사항', order.recipient.deliveryNote || '없음'],
      ['배송', order.delivery.trackingNumber ? order.delivery.carrier + ' ' + order.delivery.trackingNumber : order.delivery.carrier + ' · 운송장 등록 전']
    ];
    values.forEach(function (entry) {
      var row = document.createElement('div');
      row.append(element('dt', '', entry[0]), element('dd', '', entry[1]));
      definition.append(row);
    });
    var events = element('ol', 'account-order__events');
    order.events.forEach(function (event) {
      var copy = dateFormatter.format(new Date(event.createdAt)) + ' · ' + event.statusLabel;
      if (event.note) copy += ' — ' + event.note;
      events.append(element('li', '', copy));
    });
    detailBody.append(definition, events);
    details.append(detailBody);
    article.append(header, items, summary, details);

    if (order.customerAction) {
      var actions = element('div', 'account-order__actions');
      var button = element('button', 'order-danger-link', order.customerAction === 'request_cancel' ? '취소 요청' : '반품·환불 요청');
      button.type = 'button';
      button.addEventListener('click', function () { openRequest(order, button); });
      actions.append(button);
      article.append(actions);
    }
    return article;
  }

  function render(payload) {
    list.replaceChildren();
    total = payload.total;
    pageSize = payload.pageSize;
    if (!payload.items.length) {
      var empty = element('p', 'account-order-empty', page > 1 ? '이 페이지에는 주문이 없습니다.' : '아직 접수한 주문이 없습니다. 마음에 드는 가방을 골라 주문서를 시작해 보세요.');
      list.append(empty);
    } else {
      payload.items.forEach(function (order) { list.append(renderOrder(order)); });
    }
    var first = total ? (page - 1) * pageSize + 1 : 0;
    var last = Math.min(page * pageSize, total);
    status.textContent = total ? '전체 ' + total + '건 중 ' + first + '–' + last + '건을 표시합니다.' : '접수된 주문이 없습니다.';
    previous.disabled = page <= 1;
    next.disabled = !payload.hasMore;
    pagination.hidden = total <= pageSize;
    list.setAttribute('aria-busy', 'false');
  }

  async function loadOrders() {
    controller?.abort();
    controller = new AbortController();
    list.setAttribute('aria-busy', 'true');
    status.textContent = '주문 내역을 불러오는 중입니다.';
    previous.disabled = true;
    next.disabled = true;
    try {
      var payload = await request('/api/orders?page=' + page, { signal: controller.signal });
      render(payload);
    } catch (error) {
      if (error.name === 'AbortError' || error.status === 401) return;
      list.replaceChildren();
      var errorPanel = element('div', 'account-order-error');
      errorPanel.append(element('p', '', error.message));
      var retry = element('button', 'order-secondary-link', '다시 시도');
      retry.type = 'button';
      retry.addEventListener('click', loadOrders);
      errorPanel.append(retry);
      list.append(errorPanel);
      list.setAttribute('aria-busy', 'false');
      status.textContent = '주문 내역을 불러오지 못했습니다.';
    }
  }

  function openRequest(order, trigger) {
    var refund = order.customerAction === 'request_refund';
    requestTarget = { order: order, trigger: trigger };
    dialogTitle.textContent = refund ? '반품·환불을 요청할까요?' : '주문 취소를 요청할까요?';
    dialogDescription.textContent = refund
      ? order.orderNumber + ' 주문의 반품·환불 검토를 요청합니다. 접수 후 반품 방법과 실제 환불 완료 여부는 관리자가 확인합니다.'
      : order.orderNumber + ' 주문의 취소를 요청합니다. 요청 접수만으로 취소가 완료되지는 않으며 관리자가 처리 상태를 확인합니다.';
    dialogLabel.textContent = refund ? '반품·환불 요청' : '취소 요청';
    dialogError.textContent = '';
    dialog.showModal();
    dialogCancel.focus();
  }

  dialogCancel.addEventListener('click', function () { requestTarget = null; dialog.close(); });
  dialogConfirm.addEventListener('click', async function () {
    if (!requestTarget || dialogConfirm.disabled) return;
    dialogConfirm.disabled = true;
    dialogCancel.disabled = true;
    dialogConfirm.setAttribute('aria-busy', 'true');
    dialogError.textContent = '';
    var target = requestTarget;
    try {
      await request('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: target.order.orderNumber, action: target.order.customerAction, revision: target.order.revision })
      });
      dialog.close();
      requestTarget = null;
      await loadOrders();
      status.textContent = target.order.customerAction === 'request_refund' ? '반품·환불 요청을 접수했습니다.' : '주문 취소 요청을 접수했습니다.';
      document.querySelector('#account-orders-title').focus();
    } catch (error) {
      dialogError.textContent = error.message;
    } finally {
      dialogConfirm.disabled = false;
      dialogCancel.disabled = false;
      dialogConfirm.removeAttribute('aria-busy');
    }
  });

  previous.addEventListener('click', function () { if (page > 1) { page -= 1; loadOrders(); } });
  next.addEventListener('click', function () { if (page * pageSize < total) { page += 1; loadOrders(); } });
  document.addEventListener('himawari:member-ready', function (event) { if (event.detail.authenticated) loadOrders(); });
  if (window.HimawariMember?.session().authenticated) loadOrders();
})();

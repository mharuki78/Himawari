(function () {
  'use strict';
  var form = document.querySelector('[data-guest-order-form]');
  if (!form) return;
  var result = document.querySelector('[data-guest-result]');
  var error = document.querySelector('[data-guest-error]');
  var money = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 });
  var current = null;

  async function request(url, options) { var response = await fetch(url, Object.assign({ cache: 'no-store', headers: { 'Content-Type': 'application/json' } }, options)); var payload = await response.json().catch(function () { return {}; }); if (!response.ok) throw new Error(payload.message || '요청을 처리하지 못했습니다.'); return payload; }
  function text(tag, value, className) { var node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node; }
  function credentials() { return { orderNumber: form.elements.orderNumber.value.trim(), email: form.elements.email.value.trim(), phone: form.elements.phone.value.trim() }; }
  function trackingUrl(order) { return order.delivery && order.delivery.trackingNumber ? 'https://www.ilogen.com/web/personal/tkSearch?t=2' : ''; }
  function render(order) {
    current = order; var fragment = document.createDocumentFragment();
    var head = document.createElement('div'); head.className = 'checkout-section__head'; head.append(text('p', 'Order status', 'kicker'), text('h2', order.statusLabel)); fragment.append(head);
    var number = text('strong', order.orderNumber, 'guest-order-number'); fragment.append(number);
    var items = document.createElement('ul'); items.className = 'guest-order-items'; order.items.forEach(function (item) { var li = document.createElement('li'); li.append(text('span', item.name + (item.optionLabel ? ' · ' + item.optionLabel : '') + ' × ' + item.quantity), text('strong', money.format(item.lineTotal))); items.append(li); }); fragment.append(items);
    var totals = document.createElement('dl'); totals.className = 'guest-order-totals'; [['총 주문금액', money.format(order.total)], ['택배사', order.delivery.carrier || '로젠택배'], ['운송장 번호', order.delivery.trackingNumber || '출고 후 표시']].forEach(function (entry) { var row = document.createElement('div'); row.append(text('dt', entry[0]), text('dd', entry[1])); totals.append(row); }); fragment.append(totals);
    var tracking = trackingUrl(order); if (tracking) { var link = document.createElement('a'); link.className = 'order-secondary-link'; link.href = tracking; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = '로젠택배 배송조회 ↗'; fragment.append(link); }
    if (order.customerAction) { var button = document.createElement('button'); button.type = 'button'; button.className = 'order-danger-link'; button.textContent = order.customerAction === 'request_cancel' ? '주문 취소 요청' : '반품·환불 요청'; button.addEventListener('click', change); fragment.append(button); }
    result.replaceChildren(fragment);
  }
  async function lookup(event) { event?.preventDefault(); error.textContent = ''; var values = credentials(); if (!values.orderNumber || !values.email || !values.phone) { error.textContent = '세 항목을 모두 입력해 주세요.'; return; } var button = form.querySelector('button[type="submit"]'); button.disabled = true; try { render((await request('/api/orders/guest', { method: 'POST', body: JSON.stringify(values) })).order); } catch (reason) { error.textContent = reason.message; result.replaceChildren(text('p', '주문 정보를 다시 확인해 주세요.')); } finally { button.disabled = false; } }
  async function change() { if (!current || !confirm(current.customerAction === 'request_cancel' ? '이 주문의 취소를 요청할까요?' : '이 주문의 반품·환불을 요청할까요?')) return; try { render((await request('/api/orders/guest/change', { method: 'PATCH', body: JSON.stringify(Object.assign(credentials(), { action: current.customerAction, revision: current.revision })) })).order); } catch (reason) { error.textContent = reason.message; } }
  form.addEventListener('submit', lookup);
  var preset = new URLSearchParams(location.search).get('order'); if (preset) form.elements.orderNumber.value = preset;
})();

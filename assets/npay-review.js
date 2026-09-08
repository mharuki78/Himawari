import { initializeNpay } from './npay.js';

const cart = [];
const summary = document.querySelector('[data-review-cart-summary]');

function optionFor(button) {
  const card = button.closest('.npay-review-card');
  return card?.querySelector('[data-npay-review-option]') || null;
}

function updateCart() {
  if (summary) {
    summary.textContent = cart.length
      ? `${cart.length}개 상품이 담겼습니다. 같은 상품을 다시 누르면 수량이 늘어납니다.`
      : '상품 카드에서 ‘검수 장바구니 담기’를 눌러 주세요.';
  }
  document.dispatchEvent(new CustomEvent('himawari:cart-change', { detail: { items: cart.slice() } }));
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-review-cart-add]');
  if (!button) return;
  const productId = button.dataset.productId;
  const option = optionFor(button);
  if (option && !option.value) {
    option.focus();
    option.setCustomValidity('옵션을 선택해 주세요.');
    option.reportValidity();
    option.addEventListener('change', () => option.setCustomValidity(''), { once: true });
    return;
  }
  const optionId = option?.value || '';
  const existing = cart.find((item) => item.id === productId && item.optionId === optionId);
  if (existing) existing.q += 1;
  else cart.push({ id: productId, optionId, q: 1 });
  button.textContent = '장바구니에 담았습니다 ✓';
  window.setTimeout(() => { button.textContent = '검수 장바구니 담기'; }, 900);
  updateCart();
});

initializeNpay({ cartItems: cart });

export const WELCOME_COUPON = Object.freeze({
  id: 'welcome-10',
  label: '신규 회원 10% 할인 쿠폰',
  type: 'percent',
  rate: 10,
  minimumSubtotal: 0,
  maximumDiscount: 0,
});

export function welcomeCouponSubtotal(items, excluded) {
  const key = ({ productId, optionId }) => JSON.stringify([productId, optionId || '']);
  const excludedKeys = new Set(excluded.map(key));
  return items.reduce((subtotal, item) => {
    return excludedKeys.has(key(item)) ? subtotal : subtotal + item.unitPrice * item.quantity;
  }, 0);
}

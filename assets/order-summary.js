import { FREE_SHIPPING_THRESHOLD, standardShippingFee } from './shipping-policy.js';

export function orderBenefits(lines, { discountAmount = 0, shippingFee } = {}) {
  let subtotal = 0, campaignSavings = 0;
  for (const line of lines) {
    if (!Number.isSafeInteger(line.unitPrice) || line.unitPrice < 0 || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) throw new Error('상품 금액과 수량을 다시 확인해 주세요.');
    subtotal += line.unitPrice * line.quantity;
    if (line.campaign && Number.isSafeInteger(line.regularPrice) && line.regularPrice > line.unitPrice) campaignSavings += (line.regularPrice - line.unitPrice) * line.quantity;
  }
  const couponSavings = Math.min(subtotal, Math.max(0, Math.floor(Number(discountAmount) || 0)));
  const shipping = lines.length ? (shippingFee ?? standardShippingFee(subtotal)) : 0;
  return { subtotal, campaignSavings, couponSavings, totalSavings: campaignSavings + couponSavings,
    shippingFee: shipping, total: subtotal - couponSavings + shipping,
    remaining: subtotal && shipping === 0 ? 0 : Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal),
    progress: subtotal && shipping === 0 ? 1 : Math.min(1, subtotal / FREE_SHIPPING_THRESHOLD) };
}

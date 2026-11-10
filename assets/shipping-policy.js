export const SHIPPING_FEE = 3_500;
export const FREE_SHIPPING_THRESHOLD = 70_000;

export function standardShippingFee(subtotal) {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
}

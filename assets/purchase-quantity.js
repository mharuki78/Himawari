export function purchaseLimit(stock) {
  if (stock === null || stock === undefined || stock === '') return 99;
  const value = Number(stock);
  return Number.isFinite(value) ? Math.max(1, Math.min(99, Math.floor(value))) : 1;
}

export function purchaseQuantity(value, stock) {
  const count = Number(value);
  return Math.min(purchaseLimit(stock), Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1);
}

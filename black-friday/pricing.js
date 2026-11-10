const hasDiscount = (regularPrice, price) =>
  Number.isSafeInteger(regularPrice) && Number.isSafeInteger(price) && price > 0 && price < regularPrice;

export function salePriceForRate(regularPrice, rate) {
  if (!Number.isSafeInteger(regularPrice) || regularPrice < 2 || !Number.isInteger(rate) || rate < 1 || rate > 99) return null;
  return Math.max(1, Math.floor(regularPrice * (100 - rate) / 100));
}

export function discountPercent(regularPrice, price) {
  return hasDiscount(regularPrice, price) ? Math.min(99, Math.round((regularPrice - price) / regularPrice * 100)) : null;
}

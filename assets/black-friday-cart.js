const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const unavailable = () => new Error('행사가 끝났거나 가격·남은 수량이 바뀐 상품이 있습니다. 블랙 프라이데이에서 다시 담아 주세요.');

export function checkoutCartLine(input, product, event) {
  const productId = String(input?.productId || '');
  const optionId = String(input?.optionId || '');
  const quantity = Math.min(99, Math.max(1, Math.floor(Number(input?.quantity) || 1)));
  const options = product?.options || [];
  const option = options.find(item => item.id === optionId);
  if (input?.blackFriday != null) {
    const selection = input.blackFriday;
    const offer = event?.items?.find(item => item.offerId === selection.offerId && item.productId === productId && item.optionId === optionId);
    if (!uuid.test(String(selection.offerId || '')) || !Number.isSafeInteger(selection.unitPrice) || selection.unitPrice < 1 ||
        !product || product.id !== productId || (options.length && !option) || event?.state !== 'open' || !Number.isFinite(Date.parse(event.endsAt)) ||
        Date.now() >= Date.parse(event.endsAt) || (event.serverTime && Date.parse(event.serverTime) >= Date.parse(event.endsAt)) ||
        !offer || offer.price !== selection.unitPrice || !Number.isSafeInteger(offer.remaining) || quantity > offer.remaining) throw unavailable();
    return { productId, optionId, optionLabel: offer.optionLabel || '', quantity, stock: offer.remaining,
      blackFriday: { offerId: selection.offerId, unitPrice: selection.unitPrice }, product: { ...product, price: offer.price } };
  }
  const stock = option ? option.stock : product?.stock;
  if (!product || product.id !== productId || (options.length && !option) || (!options.length && optionId) || stock === 0) throw new Error('현재 주문할 수 없는 상품이 있습니다. 장바구니에서 다시 확인해 주세요.');
  return { productId, optionId, optionLabel: option?.label || '', quantity: stock == null ? quantity : Math.min(quantity, stock), stock, product };
}

export function checkoutItemsInput(items) {
  return items.map(item => ({ productId: item.productId, optionId: item.optionId || '', quantity: item.quantity,
    ...(item.blackFriday ? { blackFriday: { ...item.blackFriday } } : {}) }));
}

function purchaseKey(item) {
  return JSON.stringify([item.productId || item.id, item.optionId || '', item.blackFriday?.offerId || '', item.blackFriday?.unitPrice || 0]);
}

export function removePurchasedCartItems(current, purchased) {
  const bought = new Map();
  for (const item of purchased) bought.set(purchaseKey(item), (bought.get(purchaseKey(item)) || 0) + Number(item.quantity || item.q || 0));
  return current.flatMap(item => {
    const key = purchaseKey(item), quantityKey = Object.hasOwn(item, 'q') ? 'q' : 'quantity';
    const quantity = Number(item[quantityKey]) || 0, removed = Math.min(quantity, bought.get(key) || 0);
    bought.set(key, (bought.get(key) || 0) - removed);
    return quantity > removed ? [{ ...item, [quantityKey]: quantity - removed }] : [];
  });
}

export function mergeRemainingCart(local, member) {
  const key = item => JSON.stringify([item.id, item.optionId || '']);
  const merged = new Map(member.map(item => {
    const product = item.product || {};
    const row = { id: item.productId, name: product.name || '', price: item.blackFriday?.unitPrice ?? product.price,
      q: item.quantity, url: product.url || '', optionId: item.optionId || '', optionLabel: item.optionLabel || '', stock: item.stock ?? null,
      ...(item.blackFriday ? { blackFriday: { ...item.blackFriday } } : {}), ...(item.blackFridayUnavailable ? { blackFridayUnavailable: true } : {}) };
    return [key(row), row];
  }));
  for (const item of local) {
    const existing = merged.get(key(item));
    if (!existing) { merged.set(key(item), item); continue; }
    const preferred = existing.blackFriday && !existing.blackFridayUnavailable ? existing
      : item.blackFriday ? item : existing.blackFriday ? existing : item;
    merged.set(key(item), { ...preferred, q: Math.max(existing.q, item.q) });
  }
  return [...merged.values()];
}

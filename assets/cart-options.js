import { productFamilyKey, productVariantLabel } from './catalog-tools.js';

const key = item => JSON.stringify([item.id, item.optionId || '']);
const context = item => JSON.stringify([item.blackFriday?.offerId || '', item.blackFriday?.unitPrice || 0]);

export function variantChoices(item, products, event) {
  const source = products.find(product => product.id === item.id);
  if (!source) return [];
  const open = event?.state === 'open' && Date.parse(event.endsAt) > Date.now() && (!event.serverTime || Date.parse(event.serverTime) < Date.parse(event.endsAt));
  return products.filter(product => productFamilyKey(product) === productFamilyKey(source)).flatMap(product => {
    return ((product.options || []).length ? product.options : [{id:'',label:'',stock:product.stock}]).map(option => {
      const sale = item.blackFriday && open && event.items?.find(offer => offer.productId === product.id && offer.optionId === option.id);
      const stock = item.blackFriday ? (sale?.remaining ?? 0) : option.stock;
      const price = item.blackFriday ? sale?.price : product.price;
      const reason = item.blackFriday && !sale ? '행사 대상 아님' : stock != null && stock < item.q ? '수량 부족' : !Number.isSafeInteger(price) || price < 1 ? '가격 확인 필요' : '';
      return { id:product.id, optionId:option.id, optionLabel:option.label || '', name:product.name, image:sale?.image || product.image,
        label:[productVariantLabel(product), option.label].filter(Boolean).join(' · '), price, stock:stock ?? null, url:product.url || '',
        ...(sale ? {blackFriday:{offerId:sale.offerId,unitPrice:sale.price}} : {}), disabled:Boolean(reason), reason };
    });
  });
}

export function replaceCartOption(cart, index, choice, { isSelected = () => true } = {}) {
  const source = cart[index];
  if (!source || choice.disabled || !Number.isSafeInteger(choice.price) || choice.price < 1) throw new Error(choice.reason || '변경할 옵션을 다시 확인해 주세요.');
  const existing = cart.findIndex((item, i) => i !== index && key(item) === key(choice));
  if (existing !== -1 && context(cart[existing]) !== context(choice)) throw new Error('같은 옵션이 다른 구매 조건으로 담겨 있습니다. 기존 상품을 확인해 주세요.');
  if (existing !== -1 && isSelected(source) !== isSelected(cart[existing])) throw new Error('선택 상태가 다른 상품과 합칠 수 없습니다. 두 상품의 선택 상태를 같게 맞춰 주세요.');
  const quantity = source.q + (existing === -1 ? 0 : cart[existing].q);
  if (quantity > 99 || (choice.stock !== null && quantity > choice.stock)) throw new Error('이미 담긴 수량을 합하면 남은 재고를 초과합니다. 수량을 줄여 주세요.');
  const replacement = {id:choice.id,optionId:choice.optionId || '',optionLabel:choice.optionLabel || '',name:choice.name,price:choice.price,q:quantity,url:choice.url || '',stock:choice.stock,
    ...(choice.blackFriday ? {blackFriday:{...choice.blackFriday}} : {})};
  return cart.flatMap((item, i) => i === index ? [replacement] : i === existing ? [] : [item]);
}

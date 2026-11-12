import { database } from './database.js';
import { productStoreIsConfigured, publicProduct, readProductCatalog, seedCatalog } from './products.js';
import { readPublicBlackFriday } from './black-friday.js';
import { ensureOrderSchema } from './orders.js';

const MAX_CART_ITEMS = 100;
const MAX_QUANTITY = 99;

async function publicCatalog() {
  const catalog = productStoreIsConfigured() ? (await readProductCatalog()).catalog : seedCatalog();
  return catalog.products.map(publicProduct);
}

function productMap(products) {
  return new Map(products.map((product) => [product.id, product]));
}

function cartStorageId(productId, optionId = '', blackFriday) {
  // Keep legacy SKU IDs untouched; campaign intent is versioned inside the existing text column.
  if (blackFriday) return '@bf1:' + Buffer.from(JSON.stringify([productId, optionId, blackFriday.offerId, blackFriday.unitPrice])).toString('base64url');
  return optionId ? `${productId}::${optionId}` : productId;
}

function splitCartStorageId(value) {
  if (String(value).startsWith('@bf1:')) {
    try {
      const [productId, optionId, offerId, unitPrice] = JSON.parse(Buffer.from(value.slice(5), 'base64url').toString());
      if (typeof productId === 'string' && typeof optionId === 'string') {
        return { productId, optionId, blackFriday: cartBlackFriday({ offerId, unitPrice }) };
      }
    } catch (_) { /* Unrecognized historical IDs still use the legacy decoder. */ }
  }
  const [productId, ...rest] = String(value || '').split('::');
  return { productId, optionId: rest.join('::') };
}

function cartBlackFriday(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.offerId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value.offerId) || !Number.isSafeInteger(value.unitPrice) || value.unitPrice < 1 || value.unitPrice > 10_000_000) {
    throw Object.assign(new Error('블랙 프라이데이 상품 정보를 확인해 주세요.'), { status: 400 });
  }
  return { offerId: value.offerId, unitPrice: value.unitPrice };
}

function cartOffer(event, item) {
  return event?.state === 'open' ? event.items.find(offer => offer.offerId === item.blackFriday.offerId && offer.productId === item.productId && (offer.optionId || '') === item.optionId && offer.price === item.blackFriday.unitPrice) : null;
}

async function cartCampaign() {
  return readPublicBlackFriday({ prepareOrders: ensureOrderSchema });
}

function productOption(product, optionId) {
  const options = Array.isArray(product?.options) ? product.options : [];
  return options.find((option) => option.id === optionId) || null;
}

export async function validateCartItems(input) {
  if (!Array.isArray(input) || input.length > MAX_CART_ITEMS) {
    throw Object.assign(new Error('장바구니 항목을 확인해 주세요.'), { status: 400 });
  }
  const products = await publicCatalog();
  const byId = productMap(products);
  const seen = new Set();
  const items = input.map((item) => {
    const productId = String(item?.productId || '').trim();
    const quantity = Number(item?.quantity);
    const optionId = String(item?.optionId || '').trim();
    const product = byId.get(productId);
    const option = productOption(product, optionId);
    const blackFriday = item?.blackFriday === undefined ? undefined : cartBlackFriday(item.blackFriday);
    const key = cartStorageId(productId, optionId);
    const available = option ? option.stock : product?.stock;
    if (!product || ((product.options.length || optionId) && !option) || seen.has(key) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY || (!blackFriday && available !== null && quantity > available)) {
      throw Object.assign(new Error('장바구니 항목을 확인해 주세요.'), { status: 400 });
    }
    seen.add(key);
    const result = { productId, optionId, quantity };
    // A saved cart is purchase intent. Keep unavailable offer identity so unrelated edits can
    // sync; reads flag live availability and checkout validates price, quota and stock again.
    if (blackFriday) result.blackFriday = blackFriday;
    return result;
  });
  return { items, products: byId };
}

export async function readMemberCart(userId) {
  const [rows, products] = await Promise.all([
    database().query('SELECT product_id, quantity FROM cart_items WHERE user_id = $1 ORDER BY created_at', [userId]),
    publicCatalog(),
  ]);
  const byId = productMap(products);
  const decoded = rows.map(row => ({ ...splitCartStorageId(row.product_id), quantity: row.quantity }));
  const event = decoded.some(item => item.blackFriday) ? await cartCampaign() : null;
  return decoded.flatMap((item) => {
    const { productId, optionId, blackFriday, quantity } = item;
    const product = byId.get(productId);
    const option = productOption(product, optionId);
    if (blackFriday) {
      const offer = cartOffer(event, item);
      return [{ productId, optionId, optionLabel: option?.label || '', stock: offer?.remaining || 0, quantity,
        product: { ...(product || { id: productId }), price: blackFriday.unitPrice }, blackFriday,
        blackFridayUnavailable: !offer || offer.remaining < 1 }];
    }
    return product && (!product.options.length || option) ? [{ productId, optionId, optionLabel: option?.label || '', stock: option?.stock ?? product.stock, quantity, product }] : [];
  });
}

export async function replaceMemberCart(userId, items) {
  const sql = database();
  const queries = [sql`DELETE FROM cart_items WHERE user_id = ${userId}`];
  for (const item of items) {
    queries.push(sql`INSERT INTO cart_items (user_id, product_id, quantity)
      VALUES (${userId}, ${cartStorageId(item.productId, item.optionId, item.blackFriday)}, ${item.quantity})`);
  }
  await sql.transaction(queries);
  return readMemberCart(userId);
}

export async function validateWishlist(input) {
  if (!Array.isArray(input) || input.length > MAX_CART_ITEMS) {
    throw Object.assign(new Error('관심상품 항목을 확인해 주세요.'), { status: 400 });
  }
  const products = await publicCatalog();
  const byId = productMap(products);
  const ids = [];
  const seen = new Set();
  for (const value of input) {
    const id = String(value || '').trim();
    if (!byId.has(id)) throw Object.assign(new Error('존재하지 않는 제품이 포함되어 있습니다.'), { status: 400 });
    if (!seen.has(id)) ids.push(id);
    seen.add(id);
  }
  return ids;
}

export async function readMemberWishlist(userId) {
  const [rows, products] = await Promise.all([
    database().query('SELECT product_id FROM wishlist_items WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
    publicCatalog(),
  ]);
  const byId = productMap(products);
  return rows.flatMap((row) => {
    const product = byId.get(row.product_id);
    return product ? [{ productId: row.product_id, product }] : [];
  });
}

export async function replaceMemberWishlist(userId, productIds) {
  const sql = database();
  const queries = [sql`DELETE FROM wishlist_items WHERE user_id = ${userId}`];
  for (const productId of productIds) {
    queries.push(sql`INSERT INTO wishlist_items (user_id, product_id) VALUES (${userId}, ${productId})`);
  }
  await sql.transaction(queries);
  return readMemberWishlist(userId);
}

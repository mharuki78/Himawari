import { database } from './database.js';
import { productStoreIsConfigured, publicProduct, readProductCatalog, seedCatalog } from './products.js';

const MAX_CART_ITEMS = 100;
const MAX_QUANTITY = 99;

async function publicCatalog() {
  const catalog = productStoreIsConfigured() ? (await readProductCatalog()).catalog : seedCatalog();
  return catalog.products.map(publicProduct);
}

function productMap(products) {
  return new Map(products.map((product) => [product.id, product]));
}

function cartStorageId(productId, optionId = '') {
  return optionId ? `${productId}::${optionId}` : productId;
}

function splitCartStorageId(value) {
  const [productId, ...rest] = String(value || '').split('::');
  return { productId, optionId: rest.join('::') };
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
    const key = cartStorageId(productId, optionId);
    const available = option ? option.stock : product?.stock;
    if (!product || (product.options.length && !option) || seen.has(key) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY || (available !== null && quantity > available)) {
      throw Object.assign(new Error('장바구니 항목을 확인해 주세요.'), { status: 400 });
    }
    seen.add(key);
    return { productId, optionId, quantity };
  });
  return { items, products: byId };
}

export async function readMemberCart(userId) {
  const [rows, products] = await Promise.all([
    database().query('SELECT product_id, quantity FROM cart_items WHERE user_id = $1 ORDER BY created_at', [userId]),
    publicCatalog(),
  ]);
  const byId = productMap(products);
  return rows.flatMap((row) => {
    const { productId, optionId } = splitCartStorageId(row.product_id);
    const product = byId.get(productId);
    const option = productOption(product, optionId);
    return product && (!product.options.length || option) ? [{ productId, optionId, optionLabel: option?.label || '', stock: option?.stock ?? product.stock, quantity: row.quantity, product }] : [];
  });
}

export async function replaceMemberCart(userId, items) {
  const sql = database();
  const queries = [sql`DELETE FROM cart_items WHERE user_id = ${userId}`];
  for (const item of items) {
    queries.push(sql`INSERT INTO cart_items (user_id, product_id, quantity)
      VALUES (${userId}, ${cartStorageId(item.productId, item.optionId)}, ${item.quantity})`);
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

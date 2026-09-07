import { database, databaseIsConfigured } from './database.js';

export async function applyInventoryReservations(products) {
  if (!databaseIsConfigured() || !Array.isArray(products) || !products.length) return products;
  let rows;
  try {
    rows = await database().query(`SELECT product_id, option_id, SUM(quantity)::integer AS reserved FROM inventory_reservations WHERE active=true GROUP BY product_id, option_id`);
  } catch (error) {
    if (error?.code === '42P01') return products;
    throw error;
  }
  const reserved = new Map(rows.map((row) => [`${row.product_id}::${row.option_id || ''}`, Number(row.reserved)]));
  return products.map((product) => {
    if (Array.isArray(product.options) && product.options.length) {
      const options = product.options.map((option) => ({ ...option, stock: Math.max(0, Number(option.stock) - (reserved.get(`${product.id}::${option.id}`) || 0)) }));
      const stock = options.reduce((sum, option) => sum + option.stock, 0);
      return { ...product, options, stock, soldOut: stock === 0 };
    }
    if (product.stock === null || product.stock === undefined) return product;
    const stock = Math.max(0, Number(product.stock) - (reserved.get(`${product.id}::`) || 0));
    return { ...product, stock, soldOut: stock === 0 };
  });
}

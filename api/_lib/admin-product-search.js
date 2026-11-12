const fold = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[\s.\-]+/g, '');

/** Shared by the paginated list and CSV export so a search exports every match. */
export function filterAdminProducts(products, query = '') {
  const terms = String(query).trim().slice(0, 160).split(/\s+/).map(fold).filter(Boolean);
  if (!terms.length) return products;
  return products.filter(product => {
    const fields = [product.id, product.model, product.name, product.tagline, ...(product.options || []).map(option => option.label)].map(fold);
    return terms.every(term => fields.some(field => field.includes(term)));
  });
}

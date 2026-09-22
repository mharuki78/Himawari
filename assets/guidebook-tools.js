// The edition's verified model-to-page mapping also distinguishes size variants.
export function productsForGuideChapter(products, chapter, guide) {
  if (!chapter || !guide?.models) return [];
  const groups = new Map();
  for (const product of products) {
    const model = guide.productOverrides?.[product.id] || String(product.model || '').trim();
    if (guide.models[model]?.page !== chapter.page) continue;
    if (!groups.has(model)) groups.set(model, []);
    groups.get(model).push(product);
  }
  return [...groups].map(([model, variants]) => ({
    model,
    variants: variants.slice().sort((a, b) => Number(a.soldOut) - Number(b.soldOut)
      || Number(/체스트벨트\s*SET/i.test(a.name)) - Number(/체스트벨트\s*SET/i.test(b.name))
      || Number(Boolean(b.featured)) - Number(Boolean(a.featured))),
  }));
}

export function matchesGuideChapter(entry, query, guide) {
  const needle = String(query).toLocaleLowerCase('ko-KR').replace(/no\.?|\s/g, '');
  const aliases = Object.entries(guide?.models || {}).filter(([, item]) => item.page === entry.page).map(([model]) => model);
  return [entry.title, ...aliases].some(value => String(value).toLocaleLowerCase('ko-KR').replace(/no\.?|\s/g, '').includes(needle));
}

const COLOR_WORDS = ['블랙', '블루', '핑크', '카키', '아이보리', '실버', '그레이', '베이지', '브라운', '민트', '퍼플', '레드', '옐로', '오렌지', '그린', '네이비', '화이트'];

export const CATALOG_CATEGORIES = Object.freeze([
  { id: 'all', label: '전체' },
  { id: 'school', label: '학생·책가방' },
  { id: 'business', label: '출근·노트북' },
  { id: 'travel', label: '여행·육아' },
  { id: 'daily', label: '데일리·미니' },
]);

function textOf(product) {
  return [product?.name, product?.model, product?.tagline, product?.description, ...(product?.highlights || [])]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('ko-KR');
}

export function productCategory(product) {
  const text = textOf(product);
  if (/(학생|책가방|등교|초등|키즈|체스트벨트)/.test(text)) return 'school';
  if (/(출근|직장|비즈니스|노트북|출장|오피스)/.test(text)) return 'business';
  if (/(여행|기저귀|유모차|캐리어|트래블)/.test(text)) return 'travel';
  return 'daily';
}

export function productFamilyKey(product) {
  const model = String(product?.model || product?.name || '').match(/(?:no\.?)?\s*(\d{3,5}[a-z]?)/i)?.[1];
  return model ? model.toLocaleUpperCase('en-US') : String(product?.id || product?.name || 'product');
}

export function productColor(product) {
  const text = `${product?.name || ''} ${product?.model || ''}`;
  return COLOR_WORDS.find((color) => text.includes(color)) || '';
}

export function productVariantLabel(product) {
  const name = String(product?.name || '').trim();
  const modelMatch = name.match(/(?:no\.?)?\s*\d{3,5}[a-z]?/i);
  const suffix = modelMatch
    ? name.slice((modelMatch.index || 0) + modelMatch[0].length).replace(/^[\s+·\-_/]+/, '').trim()
    : '';
  return suffix || productColor(product) || String(product?.model || '기본');
}

export function groupProductFamilies(products) {
  const families = new Map();
  (Array.isArray(products) ? products : []).forEach((product) => {
    const key = productFamilyKey(product);
    const current = families.get(key);
    if (!current) {
      families.set(key, { key, representative: product, variants: [product], category: productCategory(product) });
      return;
    }
    current.variants.push(product);
    const imported = product.url?.startsWith('https://www.coupang.com/');
    const currentImported = current.representative.url?.startsWith('https://www.coupang.com/');
    if ((!imported && currentImported) || (imported === currentImported && (product.featured || (!current.representative.featured && product.price < current.representative.price)))) {
      current.representative = product;
    }
  });
  return [...families.values()].map((family) => ({
    ...family,
    colors: [...new Set(family.variants.map(productColor).filter(Boolean))],
    minPrice: Math.min(...family.variants.map((item) => Number(item.price) || Infinity)),
    inStock: family.variants.some((item) => !item.soldOut),
    searchText: family.variants.map(textOf).join(' '),
  }));
}

export function filterAndSortFamilies(families, { query = '', category = 'all', sort = 'featured' } = {}) {
  const needle = String(query).trim().toLocaleLowerCase('ko-KR');
  const visible = families.filter((family) => {
    const matchesCategory = category === 'all' || family.category === category;
    return matchesCategory && (!needle || family.searchText.includes(needle));
  });
  return visible.sort((a, b) => {
    if (sort === 'price-low') return a.minPrice - b.minPrice;
    if (sort === 'price-high') return b.minPrice - a.minPrice;
    if (sort === 'name') return a.representative.name.localeCompare(b.representative.name, 'ko-KR');
    return Number(Boolean(b.representative.featured)) - Number(Boolean(a.representative.featured));
  });
}

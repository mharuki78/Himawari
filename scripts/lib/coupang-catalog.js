import { createHash } from 'node:crypto';

const modelPattern = /No\s*\.?\s*([A-Za-z]*\d+[A-Za-z]*)(?:\s*(Mini))?/i;
const compact = (value) => String(value || '').replace(/\s+/g, '').toUpperCase();

export function identity(name) {
  const match = String(name).match(modelPattern);
  if (!match) {
    if (/체스트벨트/.test(name)) return { model: 'CHEST-BELT', color: '블랙' };
    throw new Error(`모델 확인 필요: ${name}`);
  }
  let model = match[1].toUpperCase().replace(/^H1084$/, '1084H');
  let color = String(name).slice(match.index + match[0].length).replace(/^[#,\s]+/, '').split(',')[0].trim();
  if (match[2] || /미니/.test(color)) { model += 'MINI'; color = color.replace(/미니/g, ''); }
  if (model === '1884' && /^(블랙|카키)M$/i.test(color)) { model += 'M'; color = color.slice(0, -1); }
  if (/SET/i.test(color)) { model += '-SET'; color = ''; }
  return { model, color: compact(color) };
}

export function parseCoupangProduct(raw) {
  const text = String(raw.name || '').replace(/\s+/g, ' ').trim();
  const name = text.split(/\s+(?:쿠폰할인|할인|[\d,]+원)/)[0].replace(/,\s*1개$/, '').trim();
  const key = identity(name);
  // The scraper joined the displayed price and unit price into a single integer.
  // Match the displayed price against that integer's prefix; never guess by length.
  const beforeUnit = text.split('(1개당')[0];
  const amounts = [...beforeUnit.matchAll(/([\d,]+)원/g)].map((m) => Number(m[1].replaceAll(',', '')));
  const price = Number(raw.price) <= 1_000_000 ? Number(raw.price) : amounts.findLast((amount) => String(raw.price).startsWith(String(amount)));
  if (!Number.isInteger(price) || price <= 0 || price > 1_000_000) throw new Error(`판매가 확인 필요: ${name}`);
  const url = new URL(raw.url);
  const image = new URL(raw.image);
  if (url.protocol !== 'https:' || url.hostname !== 'www.coupang.com' || !/^\/vp\/products\/\d+$/.test(url.pathname)) throw new Error('쿠팡 상품 URL 오류');
  if (image.protocol !== 'https:' || !/(^|\.)coupangcdn\.com$/.test(image.hostname)) throw new Error('쿠팡 이미지 URL 오류');
  return { ...key, name, price, image: image.href, url: url.href, soldOut: /일시품절/.test(text) };
}

export function planCoupangImport(rawProducts, existing) {
  const known = existing.map((p) => ({ ...identity(p.name), id: p.id }));
  const seen = new Map();
  const additions = [];
  const skipped = [];
  const pending = [];
  const parsed = rawProducts.map(parseCoupangProduct);
  const conflicts = new Set();
  for (const p of parsed) {
    const key = `${p.model}|${p.color}`;
    const prior = seen.get(key);
    if (prior && (prior.price !== p.price || prior.image !== p.image || prior.soldOut !== p.soldOut)) conflicts.add(key);
    seen.set(key, p);
  }
  seen.clear();
  for (const p of parsed) {
    const key = `${p.model}|${p.color}`;
    const duplicate = known.find((k) => k.model === p.model && (!p.color || !k.color || k.color === p.color));
    if (duplicate) { skipped.push({ name: p.name, reason: 'existing', existingId: duplicate.id }); continue; }
    if (conflicts.has(key)) { pending.push(p); continue; }
    if (seen.has(key)) {
      const prior = seen.get(key);
      if (prior.price !== p.price || prior.image !== p.image || prior.soldOut !== p.soldOut) throw new Error(`동일 상품 정보 불일치: ${key}`);
      skipped.push({ name: p.name, reason: 'file-duplicate' }); continue;
    }
    seen.set(key, p);
    const model = p.model === 'CHEST-BELT' ? '체스트벨트' : `No.${p.model}`;
    const name = p.name.replace(modelPattern, model).replace('#', '').replaceAll(', ', ' ');
    const summary = name.replace(/^(히마와리|Himawari)\s*/i, '').split(/No\./i)[0].trim();
    additions.push({
      id: `coupang-${createHash('sha256').update(key).digest('hex').slice(0, 16)}`,
      name, model, price: p.price, naverPrice: p.price, naverDiscountRate: null,
      tagline: `${model}${p.color ? ` · ${p.color}` : ''} ${summary}`.slice(0, 120),
      description: `${name}. 제품의 색상과 형태는 상품 사진을 확인해 주세요.`,
      highlights: [summary], image: p.image, gallery: [], url: p.url,
      featured: false, curatedRank: null, createdAt: new Date().toISOString(),
      stock: p.soldOut ? 0 : null, options: [], managedImages: [],
    });
  }
  return { additions, skipped, pending, rawCount: rawProducts.length };
}

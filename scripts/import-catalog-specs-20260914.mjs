import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import reviewed from '../data/catalog-specs-20260914.json' with { type: 'json' };

export function enrichCatalogSpecs(products) {
  const matched = [], unmatched = [], changes = [];
  const updated = products.map(product => {
    const key = reviewed.productOverrides[product.id] || product.model;
    const entry = reviewed.models[key];
    const specs = { ...product.specs, care: reviewed.care, warranty: '당사 문의' };
    if (entry) {
      Object.assign(specs, entry.specs);
      // Color-specific weights must not leak into other options.
      if (key === 'No.0515') specs.weight = /실버/.test(product.name) ? '750 g' : /블랙/.test(product.name) ? '850 g' : '블랙 850 g / 실버 750 g';
      const preserved = ['capacity', 'laptopCompartment'].filter(field => specs[field] && !Object.hasOwn(entry.specs, field));
      specs.measurementNote = `2026-09-14 제조사 카탈로그 ${entry.page}페이지의 ${entry.catalogModel} 기준. 외부 크기는 가로 × 세로 × 폭 순서이며 생산 시기·측정 방식에 따라 차이가 있을 수 있습니다.`;
      if (preserved.length) specs.measurementNote += ' 용량·수납칸 중 새 카탈로그 미기재 항목은 기존 2026 제품 가이드북 정보를 유지했습니다.';
      if (/체스트벨트\s*SET/i.test(product.name)) specs.measurementNote += ' 크기·무게는 가방 기준이며 추가 체스트벨트는 제외합니다.';
      if (key === 'No.0403') specs.measurementNote += ' 외부 크기는 백팩 기준이며 숄더백은 별도 23 × 18 cm로 표기됩니다. 900 g의 구성품 포함 여부는 미기재입니다.';
      matched.push({ id: product.id, model: product.model, matchedModel: key, page: entry.page });
    } else unmatched.push({ id: product.id, model: product.model });
    for (const [field, after] of Object.entries(specs)) {
      if (product.specs?.[field] !== after) changes.push({ id: product.id, field, before: product.specs?.[field] || '', after });
    }
    return { ...product, specs };
  });
  return { products: updated, matched, unmatched, changes };
}

async function main() {
  const { readProductCatalog, writeProductCatalog, seedCatalog } = await import('../api/_lib/products.js');
  const current = await readProductCatalog();
  if (!current.persisted || !current.etag) throw new Error('Live catalog and ETag required');
  const result = enrichCatalogSpecs(current.catalog.products);
  const directory = new URL('../backups/catalog-spec-review-2026-09-21/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('preview.json', directory), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ revision: current.catalog.revision, matched: result.matched.length, unmatched: result.unmatched, changedFields: result.changes.length }));
  if (!process.argv.includes('--apply')) return;
  await writeFile(new URL(`before-${current.catalog.revision}.json`, directory), JSON.stringify(current, null, 2));
  const saved = result.changes.length ? await writeProductCatalog({ ...current.catalog, products: result.products }, current.etag) : current;
  const seedUrl = new URL('../products.json', import.meta.url);
  const seed = JSON.parse(await readFile(seedUrl, 'utf8'));
  const normalized = seedCatalog().products;
  const fallback = enrichCatalogSpecs(normalized).products;
  const byId = new Map(saved.catalog.products.map(p => [p.id, p.specs]));
  seed.products = seed.products.map((p, i) => ({ ...p, specs: byId.get(normalized[i].id) || fallback[i].specs }));
  await writeFile(seedUrl, JSON.stringify(seed, null, 2) + '\n');
  const verified = await readProductCatalog();
  if (!verified.persisted || JSON.stringify(verified.catalog.products) !== JSON.stringify(saved.catalog.products)) throw new Error('Live catalog verification failed');
  await writeFile(new URL('receipt.json', directory), JSON.stringify({ revision: saved.catalog.revision, matched: result.matched, unmatched: result.unmatched, changedFields: result.changes.length, verified: true, at: new Date().toISOString() }, null, 2));
  console.log(`Saved and verified revision ${saved.catalog.revision}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

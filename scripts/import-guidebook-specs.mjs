import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import guide from '../data/guidebook-specs-2026.json' with { type: 'json' };

// Exact models only: 124S must never receive 124 specifications.
export function matchGuidebookSpecs(product) {
  const model = guide.productOverrides[product.id] || String(product.model || '').trim();
  const entry = guide.models[model];
  if (!entry) return null;
  const specs = { ...entry.specs };
  if (/체스트벨트\s*SET/i.test(product.name || '')) {
    specs.measurementNote += ' 크기·무게는 가이드북의 가방 기준이며 추가 체스트벨트는 포함하지 않습니다.';
  }
  return specs;
}

export function enrichGuidebookCatalog(products) {
  const changed = [], unmatched = new Set(), conflicts = [];
  const updated = products.map(product => {
    const incoming = matchGuidebookSpecs(product);
    if (!incoming) { unmatched.add(product.model); return product; }
    const specs = { ...product.specs };
    let modified = false;
    for (const [key, value] of Object.entries(incoming)) {
      if (!String(specs[key] || '').trim()) { specs[key] = value; modified = true; }
      else if (specs[key] !== value) conflicts.push({ id: product.id, field: key, current: specs[key], incoming: value });
    }
    if (!modified) return product;
    changed.push({ id: product.id, model: product.model, name: product.name, specs });
    return { ...product, specs };
  });
  return { products: updated, changed, unmatched: [...unmatched], conflicts };
}

async function main() {
  const { readProductCatalog, writeProductCatalog, seedCatalog } = await import('../api/_lib/products.js');
  const current = await readProductCatalog();
  if (!current.persisted || !current.etag) throw new Error('실제 저장된 카탈로그와 ETag가 필요합니다.');
  const result = enrichGuidebookCatalog(current.catalog.products);
  const directory = new URL('../backups/guidebook-2026/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('import-preview.json', directory), JSON.stringify({ revision: current.catalog.revision, ...result }, null, 2));
  console.log(JSON.stringify({ revision: current.catalog.revision, matchedProducts: result.changed.length, unmatchedModels: result.unmatched, conflicts: result.conflicts.length }));
  if (!process.argv.includes('--apply')) return;
  if (result.conflicts.length) throw new Error('기존 사양과 충돌합니다. 검토 후 반영하세요.');
  if (!result.changed.length) return;
  await writeFile(new URL(`catalog-revision-${current.catalog.revision}.json`, directory), JSON.stringify(current, null, 2));
  const saved = await writeProductCatalog({ ...current.catalog, products: result.products }, current.etag);
  // Keep the fallback catalog consistent without copying private Blob metadata.
  const seedUrl = new URL('../products.json', import.meta.url);
  const seed = JSON.parse(await readFile(seedUrl, 'utf8'));
  const byId = new Map(saved.catalog.products.map(p => [p.id, p]));
  const normalizedSeed = seedCatalog().products;
  seed.products = seed.products.map((p, index) => {
    const id = normalizedSeed[index].id;
    const live = byId.get(id);
    const incoming = live?.specs || matchGuidebookSpecs(normalizedSeed[index]);
    return incoming && Object.values(incoming).some(Boolean) ? { ...p, specs: { ...p.specs, ...incoming } } : p;
  });
  await writeFile(seedUrl, JSON.stringify(seed, null, 2) + '\n');
  await writeFile(new URL('import-receipt.json', directory), JSON.stringify({ revision: saved.catalog.revision, changed: result.changed.map(p => p.id), at: new Date().toISOString() }, null, 2));
  console.log(`Saved catalog revision ${saved.catalog.revision}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

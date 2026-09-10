import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { put } from '@vercel/blob';
import { planCoupangImport } from './lib/coupang-catalog.js';
import { publicProduct, readProductCatalog, writeProductCatalog } from '../api/_lib/products.js';

const file = process.argv[2];
const apply = process.argv.includes('--apply');
if (!file) throw new Error('사용법: node --env-file=.env.local scripts/import-coupang-products.mjs <원본.json> [--apply]');
const folder = join('backups', 'coupang', new Date().toISOString().replaceAll(':', '-'));
await mkdir(folder, { recursive: true });
const current = await readProductCatalog();
if (!current.persisted || !current.etag) throw new Error('운영 카탈로그와 ETag를 확인해야 합니다.');
await writeFile(join(folder, 'before.json'), JSON.stringify(current, null, 2));
const source = JSON.parse(await readFile(file, 'utf8'));
const plan = planCoupangImport(source.products, current.catalog.products);
await writeFile(join(folder, 'plan.json'), JSON.stringify(plan, null, 2));
console.log(JSON.stringify({ folder, raw: plan.rawCount, additions: plan.additions.length, skipped: plan.skipped.length, pending: plan.pending.length, apply }));
if (apply && plan.additions.length) {
  const mediaTypes = new Map();
  // Finish every image download before changing the public catalog.
  for (const [index, product] of plan.additions.entries()) {
    const url = product.image.replace('/230x230ex/', '/1000x1000ex/');
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok || !/^image\/(jpeg|png|webp)/.test(response.headers.get('content-type') || '')) throw new Error(`이미지 오류: ${product.id}`);
    const image = Buffer.from(await response.arrayBuffer());
    if (image.length < 1000 || image.length > 8 * 1024 * 1024) throw new Error(`이미지 크기 오류: ${product.id}`);
    await writeFile(join(folder, `${product.id}.jpg`), image);
    mediaTypes.set(product.id, response.headers.get('content-type').split(';')[0]);
    if ((index + 1) % 20 === 0) console.log(`이미지 확인 ${index + 1}/${plan.additions.length}`);
  }
  for (const [index, product] of plan.additions.entries()) {
    const blob = await put(`product-media/coupang-import/${product.id}/main.jpg`, await readFile(join(folder, `${product.id}.jpg`)), {
      access: 'public', token: process.env.PRODUCT_BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: true, contentType: mediaTypes.get(product.id), cacheControlMaxAge: 31536000,
    });
    product.image = blob.url;
    product.managedImages = [blob.url];
    if ((index + 1) % 20 === 0) console.log(`이미지 저장 ${index + 1}/${plan.additions.length}`);
  }
  const result = await writeProductCatalog({ ...current.catalog, products: [...current.catalog.products, ...plan.additions] }, current.etag);
  if (JSON.stringify(result.catalog.products.slice(0, current.catalog.products.length).map(publicProduct)) !== JSON.stringify(current.catalog.products.map(publicProduct))) throw new Error('기존 상품 변경 감지');
  await writeFile(join(folder, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ saved: plan.additions.length, total: result.catalog.products.length, revision: result.catalog.revision, folder }));
}

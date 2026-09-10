import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { database } from '../api/_lib/database.js';
import { ensureCustomerFeatureSchema } from '../api/_lib/customer-features.js';
import { readProductCatalog } from '../api/_lib/products.js';
import { normalizeCoupangReviews } from '../api/_lib/coupang-reviews.js';

const file = process.argv[2];
if (!file) throw new Error('사용법: node --env-file=.env.local scripts/import-coupang-reviews.mjs <원본.json> [--apply]');
const { catalog } = await readProductCatalog();
const reviews = normalizeCoupangReviews(JSON.parse(await readFile(file, 'utf8')), catalog.products);
const summary = { records: reviews.length, models: new Set(reviews.map(r => r.groupKey)).size,
  withText: reviews.filter(r => r.content || r.title !== '별점 리뷰').length,
  media: reviews.reduce((sum, r) => sum + r.mediaUrls.length, 0), apply: process.argv.includes('--apply') };
console.log(JSON.stringify(summary));
if (summary.apply) {
  await ensureCustomerFeatureSchema();
  const sql = database();
  const folder = join('backups', 'coupang-reviews', new Date().toISOString().replaceAll(':', '-'));
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, 'before.json'), JSON.stringify(await sql`SELECT * FROM product_reviews ORDER BY id`, null, 2));
  await writeFile(join(folder, 'normalized.json'), JSON.stringify(reviews, null, 2));
  const result = await sql.transaction(reviews.map(r => sql.query(
    `INSERT INTO product_reviews (id, product_id, reviewer_name, rating, content, status, verified, created_at, source, source_review_id, source_url, source_product_name, review_group_key, media_urls, title, source_seller)
      VALUES ($1,$2,$3,$4,$5,$9,false,$6,'coupang',$7,$8,$10,$11,$12::jsonb,$13,$14)
      ON CONFLICT (source, source_review_id) WHERE source_review_id IS NOT NULL DO NOTHING RETURNING id`,
    [`coupang-${r.sourceReviewId}`, r.productId, r.reviewerName, r.rating, r.content, r.createdAt, r.sourceReviewId, r.sourceUrl, r.status, r.sourceProductName, r.groupKey, JSON.stringify(r.mediaUrls), r.title, r.sourceSeller],
  )));
  const imported = result.reduce((sum, rows) => sum + rows.length, 0);
  await writeFile(join(folder, 'result.json'), JSON.stringify({ ...summary, imported, skippedExisting: reviews.length - imported }, null, 2));
  console.log(JSON.stringify({ imported, skippedExisting: reviews.length - imported, backup: folder }));
}

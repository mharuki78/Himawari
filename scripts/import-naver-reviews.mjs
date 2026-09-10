import { readFile } from 'node:fs/promises';
import { database } from '../api/_lib/database.js';
import { ensureCustomerFeatureSchema } from '../api/_lib/customer-features.js';
import { normalizeNaverReviews } from '../api/_lib/naver-reviews.js';

const file = process.argv[2];
if (!file) throw new Error('사용법: node --env-file=<환경파일> scripts/import-naver-reviews.mjs <정규화된 원본.json> [--apply]');
const records = JSON.parse(await readFile(file, 'utf8'));
// Source product IDs must come from the seller export, including retired products.
const reviews = normalizeNaverReviews(records, records.map((record) => record.productId));
console.log(JSON.stringify({ records: reviews.length, products: new Set(reviews.map((review) => review.productId)).size, apply: process.argv.includes('--apply') }));
if (process.argv.includes('--apply')) {
  await ensureCustomerFeatureSchema();
  const sql = database();
  const result = await sql.transaction(reviews.map((review) => sql.query(
    `INSERT INTO product_reviews (id, product_id, reviewer_name, rating, content, status, verified, created_at, source, source_review_id, source_url, source_product_name, review_group_key, media_urls, title)
      VALUES ($1,$2,$3,$4,$5,$9,false,$6,'naver',$7,$8,$10,$11,$12::jsonb,$13)
      ON CONFLICT (source, source_review_id) WHERE source_review_id IS NOT NULL DO NOTHING RETURNING id`,
    [`naver-${review.sourceReviewId}`, review.productId, review.reviewerName, review.rating, review.content, review.createdAt, review.sourceReviewId, review.sourceUrl, review.status, review.sourceProductName, review.groupKey, JSON.stringify(review.mediaUrls), review.title],
  )));
  console.log(JSON.stringify({ imported: result.reduce((sum, rows) => sum + rows.length, 0), skippedExisting: reviews.length - result.reduce((sum, rows) => sum + rows.length, 0) }));
}

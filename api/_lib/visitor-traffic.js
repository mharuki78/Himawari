import posts from '../../story/posts.json' with { type: 'json' };
import { STORY_PATH, VISITOR_PAGES, VISITOR_PRODUCT_PAGES, visitorDay } from '../../assets/visitor-pages.js';
import { database, databaseIsConfigured } from './database.js';
import { authIsConfigured, readAdminSession } from './auth.js';
import { isSameOrigin, json, methodNotAllowed, readJson } from './http.js';
import { readProductCatalog } from './products.js';

export const VISITOR_SCHEMA = `CREATE TABLE IF NOT EXISTS visitor_traffic_daily (
  visited_on date NOT NULL,
  page text NOT NULL,
  product_id text NOT NULL DEFAULT '',
  views bigint NOT NULL DEFAULT 0,
  visits bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (visited_on, page, product_id)
)`;

const storyTitles = new Map(posts
  .map(({ url, title }) => [`/story/${url}`, title])
  .filter(([path]) => STORY_PATH.test(path)));
const reportHeaders = { Vary: 'Cookie' };
let schemaPromise;
let catalogCache;

function prepareSchema() {
  if (!schemaPromise) {
    schemaPromise = database().query(VISITOR_SCHEMA).catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

function publishedProducts() {
  if (!catalogCache || catalogCache.expires <= Date.now()) {
    const entry = { expires: Date.now() + 60_000 };
    entry.products = readProductCatalog().then(({ catalog }) =>
      new Map(catalog.products.map((product) => [product.id, product.name])), (error) => {
      if (catalogCache === entry) catalogCache = undefined;
      throw error;
    });
    catalogCache = entry;
  }
  return catalogCache.products;
}

export function validateVisitorView(input) {
  if (!input || typeof input.page !== 'string' || typeof input.productId !== 'string' ||
      typeof input.newVisitor !== 'boolean') return null;
  const { page, productId, newVisitor } = input;
  if (!Object.hasOwn(VISITOR_PAGES, page) && !storyTitles.has(page)) return null;
  if (VISITOR_PRODUCT_PAGES.has(page) ? !/^[a-zA-Z0-9_-]{1,120}$/.test(productId) : productId !== '') return null;
  return { page, productId, newVisitor };
}

export async function recordVisitorView(sql, day, { page, productId, newVisitor }) {
  await sql.query(`INSERT INTO visitor_traffic_daily (visited_on, page, product_id, views, visits)
    VALUES ($1, $2, $3, 1, $4)
    ON CONFLICT (visited_on, page, product_id) DO UPDATE SET
      views = visitor_traffic_daily.views + EXCLUDED.views,
      visits = visitor_traffic_daily.visits + EXCLUDED.visits`, [day, page, productId, Number(newVisitor)]);
}

export async function fetchVisitorView(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  if (!isSameOrigin(request) || request.headers.get('sec-purpose')?.includes('prefetch')) return json({}, 403);
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') return json({}, 503);
  try {
    const view = validateVisitorView(await readJson(request, 512));
    if (!view || (view.productId && !(await publishedProducts()).has(view.productId))) return json({}, 400);
    await prepareSchema();
    await recordVisitorView(database(), visitorDay(), view);
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = Number(error.status) || 503;
    return json({}, status >= 500 ? 503 : status);
  }
}

const DAY_MS = 86_400_000;

export async function readVisitorTraffic(sql, days, endTime = Date.now()) {
  const end = visitorDay(endTime);
  const start = visitorDay(endTime - (days - 1) * DAY_MS);
  const [result] = await sql.query(`WITH selected AS (
      SELECT * FROM visitor_traffic_daily WHERE visited_on BETWEEN $1::date AND $2::date
    ), daily AS (
      SELECT to_char(visited_on, 'YYYY-MM-DD') AS day, sum(views)::bigint AS views, sum(visits)::bigint AS visits,
        coalesce(sum(views) FILTER (WHERE product_id <> ''), 0)::bigint AS "productViews"
      FROM selected GROUP BY visited_on ORDER BY visited_on
    ), pages AS (
      SELECT page, sum(views)::bigint AS views FROM selected GROUP BY page ORDER BY views DESC, page LIMIT 10
    ), products AS (
      SELECT product_id AS id, sum(views)::bigint AS views FROM selected
      WHERE product_id <> '' GROUP BY product_id ORDER BY views DESC, id LIMIT 10
    ) SELECT
      (SELECT json_agg(daily ORDER BY day) FROM daily) AS daily,
      (SELECT json_agg(pages ORDER BY views DESC, page) FROM pages) AS pages,
      (SELECT json_agg(products ORDER BY views DESC, id) FROM products) AS products`, [start, end]);
  const byDay = new Map((result.daily ?? []).map((row) => [row.day, row]));
  const daily = Array.from({ length: days }, (_, index) => {
    const day = visitorDay(endTime - (days - 1 - index) * DAY_MS);
    return byDay.get(day) ?? { day, visits: 0, views: 0, productViews: 0 };
  });
  return { daily, pages: result.pages ?? [], products: result.products ?? [] };
}

export async function fetchVisitorTraffic(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  if (!authIsConfigured()) return json({ message: '관리자 인증 설정을 확인해 주세요.' }, 503, reportHeaders);
  if (!readAdminSession(request)) return json({ message: '관리자 로그인이 필요합니다.' }, 401, reportHeaders);
  if (!databaseIsConfigured()) return json({ message: '통계 저장소에 연결할 수 없습니다.' }, 503, reportHeaders);

  const params = new URL(request.url).searchParams;
  const selectedDay = params.get('date');
  const days = selectedDay === null ? Number(params.get('days') ?? 7) : 1;
  if (![1, 7, 30, 90].includes(days)) return json({ message: '조회 기간을 확인해 주세요.' }, 400, reportHeaders);
  const now = Date.now();
  let endTime = now;
  if (selectedDay !== null) {
    endTime = Date.parse(`${selectedDay}T00:00:00+09:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDay) || !Number.isFinite(endTime) ||
        visitorDay(endTime) !== selectedDay || selectedDay < visitorDay(now - 89 * DAY_MS) || selectedDay > visitorDay(now)) {
      return json({ message: '최근 90일 안에서 날짜를 선택해 주세요.' }, 400, reportHeaders);
    }
  }
  try {
    await prepareSchema();
    const report = await readVisitorTraffic(database(), days, endTime);
    const products = report.products.length ? await publishedProducts().catch(() => new Map()) : new Map();
    return json({
      daily: report.daily,
      pages: report.pages.map(({ page, views }) => ({ path: page, name: VISITOR_PAGES[page] ?? storyTitles.get(page) ?? '이야기', views })),
      products: report.products.map(({ id, views }) => ({ id, name: products.get(id) ?? id, views, listed: products.has(id) })),
    }, 200, reportHeaders);
  } catch {
    return json({ message: '방문 통계를 불러오지 못했습니다. 다시 시도해 주세요.' }, 503, reportHeaders);
  }
}

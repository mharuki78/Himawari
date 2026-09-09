const base = String(process.env.SMOKE_BASE_URL || 'https://himawari.co.kr').replace(/\/$/, '');
const routes = ['/', '/products.html', '/collections/school', '/collections/business', '/collections/travel', '/collections/daily', '/sitemap.xml', '/google-merchant-feed.xml', '/api/reels', '/api/health'];
let failed = false;
for (const route of routes) {
  try {
    const response = await fetch(`${base}${route}`, { redirect: 'follow', signal: AbortSignal.timeout(15_000) });
    const valid = response.ok && (route !== '/api/health' || (await response.clone().json()).ok === true);
    console.log(`${valid ? 'PASS' : 'FAIL'} ${response.status} ${route}`);
    if (!valid) failed = true;
  } catch (error) {
    failed = true;
    console.log(`FAIL ${route} ${error.message}`);
  }
}
if (failed) process.exitCode = 1;

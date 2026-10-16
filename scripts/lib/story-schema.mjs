const ORIGIN = 'https://himawari.co.kr';
const JSON_LD = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g;

// Enrich metadata only: dates, author identity and visible article content remain authoritative.
export function updateStorySchema(html) {
  const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  if (!canonical?.startsWith(`${ORIGIN}/story/`)) throw new Error('Missing canonical story URL');
  const articleHtml = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/)?.[1];
  if (!articleHtml) throw new Error('Missing visible article');
  const images = [...new Set([...articleHtml.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].flatMap(([, src]) => {
    const url = new URL(src.replaceAll('&amp;', '&'), canonical);
    return url.protocol === 'https:' ? [url.href] : [];
  }))];
  let found = false;
  const output = html.replace(JSON_LD, (tag, json) => {
    const data = JSON.parse(json);
    if (data['@type'] !== 'BlogPosting') return tag;
    found = true;
    const author = data.author || { '@type': 'Organization', name: '히마와리 편집팀' };
    const enriched = {
      ...data,
      '@id': `${canonical}#article`,
      url: canonical,
      image: images,
      author: { ...author, ...(author['@type'] === 'Organization' && !author.url ? { url: `${ORIGIN}/` } : {}) },
      publisher: {
        '@type': 'Organization', '@id': `${ORIGIN}/#organization`, name: 'Himawari', url: `${ORIGIN}/`,
        logo: { '@type': 'ImageObject', url: `${ORIGIN}/assets/himawari-logo-hq.png` },
      },
      inLanguage: 'ko-KR',
      isPartOf: { '@type': 'Blog', '@id': `${ORIGIN}/story/#blog`, name: 'Himawari 이야기', url: `${ORIGIN}/story/` },
    };
    return `<script type="application/ld+json">${JSON.stringify(enriched).replaceAll('<', '\\u003c')}</script>`;
  });
  if (!found) throw new Error('Missing BlogPosting structured data');
  return output;
}

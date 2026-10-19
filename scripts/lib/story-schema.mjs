const ORIGIN = 'https://himawari.co.kr';
const JSON_LD = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g;

function verifiedTime(value, date, field) {
  if (value == null) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid ${field}: explicit time and timezone required`);
  }
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  if (day !== date) throw new Error(`${field} differs from the recorded Korean calendar date`);
  return value;
}

// Timestamps are optional, backed by publication evidence; never infer a time from a date.
export function updateStorySchema(html, post = {}) {
  const publishedAt = verifiedTime(post.publishedAt, post.date, 'publishedAt');
  const modifiedAt = verifiedTime(post.modifiedAt, post.dateModified || post.date, 'modifiedAt');
  if (publishedAt && modifiedAt && Date.parse(modifiedAt) < Date.parse(publishedAt)) throw new Error('Modification is before publication');
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
      datePublished: publishedAt || data.datePublished,
      dateModified: modifiedAt || data.dateModified,
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

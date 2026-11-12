import { head } from '@vercel/blob';
import { IMAGE_TYPES, MAX_MAIN_IMAGE_SIZE, REQUEST_ID_PATTERN } from './products.js';

export const MAX_BANNER_SIZE = MAX_MAIN_IMAGE_SIZE;
const invalid = () => Object.assign(new Error('배너 이미지를 확인할 수 없습니다. JPG·PNG·WebP·AVIF 파일을 8MB 이하로 다시 선택해 주세요.'), { status: 400 });

export function classifyBlackFridayBannerPath(pathname, requestId) {
  if (!REQUEST_ID_PATTERN.test(String(requestId || ''))) return '';
  const prefix = `black-friday-banners/${requestId}/`;
  return typeof pathname === 'string' && pathname.startsWith(prefix) && /^banner(?:-[a-z0-9]+)?\.(?:jpe?g|png|webp|avif)$/i.test(pathname.slice(prefix.length)) ? 'black-friday-banner' : '';
}

export async function verifyBlackFridayBanner(value) {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || typeof value.url !== 'string' || typeof value.alt !== 'string' || value.alt.length > 200) throw invalid();
  let url;
  try { url = new URL(value.url); } catch { throw invalid(); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash ||
      !/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i.test(url.hostname) ||
      !classifyBlackFridayBannerPath(url.pathname.slice(1), value.requestId) ||
      ![value.width, value.height].every(size => Number.isSafeInteger(size) && size > 0 && size <= 20000)) throw invalid();
  let metadata;
  try { metadata = await head(url.href, { token: process.env.PRODUCT_BLOB_READ_WRITE_TOKEN }); } catch { throw invalid(); }
  if (metadata.url !== url.href || metadata.pathname !== url.pathname.slice(1) || !IMAGE_TYPES.has(metadata.contentType) ||
      !Number.isFinite(metadata.size) || metadata.size <= 0 || metadata.size > MAX_BANNER_SIZE) throw invalid();
  return { requestId: value.requestId, url: metadata.url, alt: value.alt.trim() || '히마와리 블랙 프라이데이', width: value.width, height: value.height };
}

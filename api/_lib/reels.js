import { BlobNotFoundError, BlobPreconditionFailedError, del, get, head, put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';

const REELS_PATH = 'home-content/v1/reels.json';
const REEL_VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);
const REEL_POSTER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_REEL_VIDEO_SIZE = 50 * 1024 * 1024;
const MAX_REEL_POSTER_SIZE = 4 * 1024 * 1024;
const MAX_REELS = 12;
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_REELS = [
  ['No.0422 영상', '01 · No.0422', '매일의 수납을 한눈에.', '/assets/reel-0422.mp4', '/assets/reel-0422-poster.jpg'],
  ['No.1088M 영상', '02 · No.1088M', '가벼운 하루의 시작.', '/assets/reel-1088m.mp4', '/assets/reel-1088m-poster.jpg'],
  ['No.1884 영상', '03 · No.1884', '출근과 출장 사이.', '/assets/reel-1884.mp4', '/assets/reel-1884-poster.jpg'],
  ['No.1027 영상', '04 · No.1027', '가볍게 시작하는 등굣길.', '/assets/reel-1027.mp4', '/assets/reel-1027-poster.jpg'],
  ['책가방 3종 영상', '05 · School collection', '세 가지 책가방, 한 장면.', '/assets/reel-school-set.mp4', '/assets/reel-school-set-poster.jpg'],
  ['No.0514 데일리 영상', '06 · No.0514', '도시의 하루를 가볍게.', '/assets/reel-0514-260527.mp4', '/assets/reel-0514-260527-poster.jpg'],
  ['No.0514 디테일 영상', '07 · No.0514 detail', '필요한 순간, 바로 꺼내도록.', '/assets/reel-0514-260604.mp4', '/assets/reel-0514-260604-poster.jpg'],
  ['No.0424 영상', '08 · No.0424', '함께 걷는 하루의 균형.', '/assets/reel-0424-260528.mp4', '/assets/reel-0424-260528-poster.jpg'],
].map((item, index) => ({ id: `default-${index + 1}`, name: item[0], label: item[1], caption: item[2], videoUrl: item[3], posterUrl: item[4], enabled: true, managedMedia: [] }));

function token() { return process.env.PRODUCT_BLOB_READ_WRITE_TOKEN || ''; }
function line(value, max = 120) { return String(value || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function normalizeEtag(value) { return String(value || '').trim().replace(/^W\//i, ''); }
function mediaUrl(value, allowLocal = false) {
  const clean = line(value, 1_000);
  if (allowLocal && /^\/assets\/[a-z0-9._/-]+$/i.test(clean)) return clean;
  try { const url = new URL(clean); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
}

export function reelsStoreIsConfigured() { return Boolean(token()); }
export function classifyReelPath(pathname, requestId) {
  const prefix = `reel-media/${requestId}/`;
  const relative = typeof pathname === 'string' && pathname.startsWith(prefix) ? pathname.slice(prefix.length) : '';
  if (/^video(?:[-.])/.test(relative)) return 'reel-video';
  if (/^poster(?:[-.])/.test(relative)) return 'reel-poster';
  return '';
}

export function defaultReelsConfig() {
  return { version: 1, revision: 1, updatedAt: '', reels: DEFAULT_REELS.map((item) => ({ ...item })) };
}

export function normalizeReelsConfig(input = {}) {
  const reels = (Array.isArray(input.reels) ? input.reels : []).slice(0, MAX_REELS).map((item, index) => ({
    id: line(item?.id, 80) || `reel-${index + 1}`,
    name: line(item?.name, 80),
    label: line(item?.label, 80),
    caption: line(item?.caption, 140),
    videoUrl: mediaUrl(item?.videoUrl, true),
    posterUrl: mediaUrl(item?.posterUrl, true),
    enabled: item?.enabled !== false,
    managedMedia: (Array.isArray(item?.managedMedia) ? item.managedMedia : []).map((url) => mediaUrl(url)).filter(Boolean),
  })).filter((item) => item.name && item.label && item.caption && item.videoUrl);
  return {
    version: 1,
    revision: Math.max(1, Number(input.revision) || 1),
    updatedAt: line(input.updatedAt, 40),
    reels: reels.length ? reels : DEFAULT_REELS.map((item) => ({ ...item })),
  };
}

export function publicReels(config) {
  return normalizeReelsConfig(config).reels.filter((item) => item.enabled).map(({ managedMedia, ...item }) => item);
}

export async function readReelsConfig() {
  if (!reelsStoreIsConfigured()) return { config: defaultReelsConfig(), etag: null, persisted: false };
  try {
    const metadata = await head(REELS_PATH, { token: token() });
    const result = await get(metadata.url, { access: 'public', token: token(), useCache: false });
    if (!result || result.statusCode !== 200) return { config: defaultReelsConfig(), etag: null, persisted: false };
    return { config: normalizeReelsConfig(JSON.parse(await new Response(result.stream).text())), etag: normalizeEtag(metadata.etag), persisted: true };
  } catch (error) {
    if (error instanceof BlobNotFoundError) return { config: defaultReelsConfig(), etag: null, persisted: false };
    throw error;
  }
}

export async function writeReelsConfig(config, etag) {
  const normalized = normalizeReelsConfig(config);
  const next = { ...normalized, revision: normalized.revision + 1, updatedAt: new Date().toISOString() };
  const result = await put(REELS_PATH, JSON.stringify(next), {
    access: 'public', token: token(), addRandomSuffix: false, allowOverwrite: Boolean(etag),
    ...(etag ? { ifMatch: normalizeEtag(etag) } : {}),
    contentType: 'application/json; charset=utf-8', cacheControlMaxAge: 60,
  });
  return { config: next, etag: normalizeEtag(result.etag) };
}

async function verifyOne(url, requestId, kind) {
  let metadata;
  try { metadata = await head(url, { token: token() }); } catch { throw Object.assign(new Error('업로드한 영상 파일을 확인할 수 없습니다.'), { status: 400 }); }
  const types = kind === 'reel-video' ? REEL_VIDEO_TYPES : REEL_POSTER_TYPES;
  const maximum = kind === 'reel-video' ? MAX_REEL_VIDEO_SIZE : MAX_REEL_POSTER_SIZE;
  if (classifyReelPath(metadata.pathname, requestId) !== kind || !types.has(metadata.contentType) || metadata.size > maximum) {
    throw Object.assign(new Error('허용되지 않은 숏폼 파일이 포함되어 있습니다.'), { status: 400 });
  }
  return metadata.url;
}

export async function verifyReelUpload({ requestId, videoUrl, posterUrl }) {
  if (!REQUEST_ID_PATTERN.test(line(requestId, 80))) throw Object.assign(new Error('업로드 요청을 새로 시작해 주세요.'), { status: 400 });
  const verifiedVideo = await verifyOne(mediaUrl(videoUrl), requestId, 'reel-video');
  const verifiedPoster = posterUrl ? await verifyOne(mediaUrl(posterUrl), requestId, 'reel-poster') : '';
  return { videoUrl: verifiedVideo, posterUrl: verifiedPoster, managedMedia: [verifiedVideo, verifiedPoster].filter(Boolean) };
}

export function validateNewReel(input, media) {
  const value = {
    id: randomUUID(), name: line(input?.name, 80), label: line(input?.label, 80), caption: line(input?.caption, 140),
    videoUrl: media.videoUrl, posterUrl: media.posterUrl, enabled: input?.enabled !== false, managedMedia: media.managedMedia,
  };
  const fieldErrors = {};
  if (value.name.length < 2) fieldErrors.name = '관리 화면에서 구분할 영상명을 2자 이상 입력해 주세요.';
  if (value.label.length < 2) fieldErrors.label = '영상에 표시할 제품·컬렉션 라벨을 입력해 주세요.';
  if (value.caption.length < 2) fieldErrors.caption = '영상 아래에 표시할 문구를 입력해 주세요.';
  return { value, fieldErrors, valid: Object.keys(fieldErrors).length === 0 };
}

export async function deleteReelMedia(urls) {
  const safe = (Array.isArray(urls) ? urls : []).map((url) => mediaUrl(url)).filter(Boolean);
  if (!safe.length) return true;
  try { await del(safe, { token: token() }); return true; } catch { return false; }
}

export { BlobPreconditionFailedError, MAX_REELS, MAX_REEL_POSTER_SIZE, MAX_REEL_VIDEO_SIZE, REEL_POSTER_TYPES, REEL_VIDEO_TYPES, REQUEST_ID_PATTERN };

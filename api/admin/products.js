import { auditedAdminRequest } from '../_lib/admin-audit.js';
import { authIsConfigured, isAdminRequest } from '../_lib/auth.js';
import { isSameOrigin, json, methodNotAllowed, readJson } from '../_lib/http.js';
import {
  BlobPreconditionFailedError,
  createProductRecord,
  deleteManagedImages,
  mergeProductMedia,
  normalizeBlobEtag,
  productStoreIsConfigured,
  publicProduct,
  readProductCatalog,
  validateProductInput,
  validateProductUpdateInput,
  verifyManagedImages,
  writeProductCatalog,
  updateProductRecord,
} from '../_lib/products.js';
import {
  BlobPreconditionFailedError as PromotionBlobPreconditionFailedError,
  promotionsStoreIsConfigured,
  readPromotions,
  validatePromotionsInput,
  writePromotions,
} from '../_lib/promotions.js';
import { blackFridayState, readBlackFridayAdmin, saveBlackFriday } from '../_lib/black-friday.js';
import { ensureOrderSchema } from '../_lib/orders.js';
import { databaseIsConfigured } from '../_lib/database.js';
import { exportProductCsv, planProductCsv, planBulkProducts } from '../_lib/product-csv.js';
import { filterAdminProducts } from '../_lib/admin-product-search.js';
import { listAdminReviews, moderateReview, notifyRestockSubscribers, publishedReviewCounts } from '../_lib/customer-features.js';
import { changeMemberStatus, listMembers } from '../_lib/admin-members.js';
import {
  BlobPreconditionFailedError as ReelsBlobPreconditionFailedError,
  MAX_REELS,
  deleteReelMedia,
  readReelsConfig,
  reelsStoreIsConfigured,
  validateNewReel,
  verifyReelUpload,
  writeReelsConfig,
} from '../_lib/reels.js';

const PAGE_SIZE = 20;

function parseCursor(value) {
  if (!value) return 0;
  if (!/^\d{1,6}$/.test(value)) return -1;
  return Number(value);
}

async function fetchBlackFriday(request) {
  const headers = { Vary: 'Cookie' };
  if (!['GET', 'PUT'].includes(request.method)) return methodNotAllowed(['GET', 'PUT']);
  if (!authIsConfigured() || !databaseIsConfigured()) return json({ message: '행사 저장소 설정을 확인해 주세요.' }, 503, headers);
  if (!isAdminRequest(request)) return json({ message: '관리자 로그인이 필요합니다.' }, 401, headers);
  if (request.method === 'PUT' && !isSameOrigin(request)) return json({ message: '이 사이트에서만 행사 설정을 저장할 수 있습니다.' }, 403, headers);
  try {
    await ensureOrderSchema();
    if (request.method === 'GET') {
      const data = await readBlackFridayAdmin();
      const counts = await publishedReviewCounts(data.catalog.map(row => ({ ...row, id: row.productId }))).catch(() => null);
      return json({ ...data, reviewCounts: counts }, 200, headers);
    }
    const config = await saveBlackFriday(await readJson(request, 512_000));
    return json({ config, state: blackFridayState(config) }, 200, headers);
  } catch (error) {
    if (error.status >= 400 && error.status < 500) return json({ message: error.message }, error.status, headers);
    console.error('admin_black_friday_failed', { message: error.message });
    return json({ message: '행사 설정을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 503, headers);
  }
}

async function fetchPromotions(request) {
  if (!['GET', 'PUT'].includes(request.method)) return methodNotAllowed(['GET', 'PUT']);
  if (!authIsConfigured() || !promotionsStoreIsConfigured()) return json({ message: '프로모션 관리 저장소 설정이 완료되지 않았습니다.' }, 503);
  if (!isAdminRequest(request)) return json({ message: '관리자 로그인이 필요합니다.' }, 401, { Vary: 'Cookie' });

  try {
    const current = await readPromotions();
    if (request.method === 'GET') return json({ config: current.config, etag: current.etag }, 200, { Vary: 'Cookie' });
    if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
    const input = await readJson(request, 24_000);
    if ((input.etag || null) !== (current.etag || null)) return json({ message: '프로모션 설정이 변경되었습니다. 새로고침한 뒤 다시 저장해 주세요.' }, 409, { Vary: 'Cookie' });
    const { value, fieldErrors, valid } = validatePromotionsInput(input.config);
    if (!valid) return json({ message: '입력 내용을 확인해 주세요.', fieldErrors }, 400, { Vary: 'Cookie' });
    const saved = await writePromotions({ ...value, revision: current.config.revision }, current.etag);
    return json({ ok: true, config: saved.config, etag: saved.etag }, 200, { Vary: 'Cookie' });
  } catch (error) {
    if (error instanceof PromotionBlobPreconditionFailedError) return json({ message: '다른 관리자 작업으로 설정이 변경되었습니다. 새로고침해 주세요.' }, 409, { Vary: 'Cookie' });
    const status = Number(error.status) || 500;
    return json({ message: status < 500 ? error.message : '프로모션 설정을 처리하지 못했습니다.' }, status, { Vary: 'Cookie' });
  }
}

async function fetchReviews(request) {
  if (!['GET', 'PATCH'].includes(request.method)) return methodNotAllowed(['GET', 'PATCH']);
  if (!authIsConfigured() || !databaseIsConfigured()) return json({ message: '리뷰 관리 설정이 완료되지 않았습니다.' }, 503);
  if (!isAdminRequest(request)) return json({ message: '관리자 로그인이 필요합니다.' }, 401, { Vary: 'Cookie' });
  try {
    if (request.method === 'GET') return json(await listAdminReviews(new URL(request.url).searchParams.get('status') || ''));
    if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
    return json(await moderateReview(await readJson(request, 8_192)));
  } catch (error) {
    const status = Number(error.status) || 500;
    return json({ message: status < 500 ? error.message : '리뷰 정보를 처리하지 못했습니다.' }, status);
  }
}

async function fetchMembers(request) {
  const headers = { Vary: 'Cookie' };
  if (!['GET', 'PATCH'].includes(request.method)) return methodNotAllowed(['GET', 'PATCH']);
  if (!isAdminRequest(request)) return json({ message: '소유자 계정으로 로그인해 주세요.' }, 401, headers);
  if (!databaseIsConfigured()) return json({ message: '회원 저장소가 연결되지 않았습니다.' }, 503, headers);
  try {
    if (request.method === 'GET') {
      const params = new URL(request.url).searchParams;
      const offset = parseCursor(params.get('offset'));
      if (offset < 0) return json({ message: '목록 위치를 확인해 주세요.' }, 400, headers);
      return json(await listMembers({ query: params.get('q') || '', status: params.get('status') || '', offset }), 200, headers);
    }
    if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403, headers);
    return json(await changeMemberStatus(await readJson(request, 4096) || {}), 200, headers);
  } catch (error) {
    const status = Number(error.status) || 500;
    return json({ message: status < 500 ? error.message : '회원 정보를 처리하지 못했습니다.' }, status, headers);
  }
}

async function fetchReels(request) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) return methodNotAllowed(['GET', 'POST', 'PATCH', 'DELETE']);
  if (!authIsConfigured() || !reelsStoreIsConfigured()) return json({ message: '영상 관리 저장소 설정이 완료되지 않았습니다.' }, 503);
  if (!isAdminRequest(request)) return json({ message: '관리자 로그인이 필요합니다.' }, 401, { Vary: 'Cookie' });
  try {
    const current = await readReelsConfig();
    if (request.method === 'GET') return json({ config: current.config, etag: current.etag }, 200, { Vary: 'Cookie' });
    if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
    const input = await readJson(request, 32_768);
    if ((input.etag || null) !== (current.etag || null)) return json({ message: '영상 목록이 변경되었습니다. 새로고침한 뒤 다시 시도해 주세요.' }, 409);

    if (request.method === 'POST') {
      if (current.config.reels.length >= MAX_REELS) return json({ message: `영상은 최대 ${MAX_REELS}개까지 등록할 수 있습니다.` }, 400);
      const media = await verifyReelUpload(input);
      const checked = validateNewReel(input, media);
      if (!checked.valid) {
        await deleteReelMedia(media.managedMedia);
        return json({ message: '입력 내용을 확인해 주세요.', fieldErrors: checked.fieldErrors }, 400);
      }
      const saved = await writeReelsConfig({ ...current.config, reels: [...current.config.reels, checked.value] }, current.etag);
      return json({ ok: true, config: saved.config, etag: saved.etag }, 201);
    }

    const id = typeof input.id === 'string' ? input.id : '';
    const reel = current.config.reels.find((item) => item.id === id);
    if (!reel) return json({ message: '영상을 찾을 수 없습니다.' }, 404);

    if (request.method === 'PATCH') {
      let reels = current.config.reels;
      if (Array.isArray(input.order)) {
        const order = input.order.filter((value) => typeof value === 'string');
        if (order.length !== reels.length || new Set(order).size !== reels.length || order.some((value) => !reels.some((item) => item.id === value))) {
          return json({ message: '영상 순서 정보가 올바르지 않습니다.' }, 400);
        }
        reels = order.map((value) => reels.find((item) => item.id === value));
      } else {
        const updated = {
          ...reel,
          name: typeof input.name === 'string' ? input.name.trim().slice(0, 80) : reel.name,
          label: typeof input.label === 'string' ? input.label.trim().slice(0, 80) : reel.label,
          caption: typeof input.caption === 'string' ? input.caption.trim().slice(0, 140) : reel.caption,
          enabled: typeof input.enabled === 'boolean' ? input.enabled : reel.enabled,
        };
        if (updated.name.length < 2 || updated.label.length < 2 || updated.caption.length < 2) return json({ message: '영상명, 라벨, 문구를 2자 이상 입력해 주세요.' }, 400);
        reels = reels.map((item) => (item.id === id ? updated : item));
      }
      const saved = await writeReelsConfig({ ...current.config, reels }, current.etag);
      return json({ ok: true, config: saved.config, etag: saved.etag });
    }

    const saved = await writeReelsConfig({ ...current.config, reels: current.config.reels.filter((item) => item.id !== id) }, current.etag);
    const mediaRemoved = await deleteReelMedia(reel.managedMedia);
    return json({ ok: true, config: saved.config, etag: saved.etag, mediaRemoved });
  } catch (error) {
    if (error instanceof ReelsBlobPreconditionFailedError) return json({ message: '다른 관리자 작업으로 영상 목록이 변경되었습니다. 새로고침해 주세요.' }, 409);
    const status = Number(error.status) || 500;
    return json({ message: status < 500 ? error.message : '영상 관리 작업을 처리하지 못했습니다.' }, status);
  }
}

async function fetchBulkProducts(request) {
  if (!['GET', 'POST', 'PUT'].includes(request.method)) return methodNotAllowed(['GET', 'POST', 'PUT']);
  if (!authIsConfigured() || !productStoreIsConfigured()) return json({ message: '제품 관리 저장소 설정이 완료되지 않았습니다.' }, 503);
  if (!isAdminRequest(request)) return json({ message: '관리자 로그인이 필요합니다.' }, 401, { Vary: 'Cookie' });
  try {
    const current = await readProductCatalog();
    if (request.method === 'GET') {
      const query = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 160);
      const products = filterAdminProducts(current.catalog.products, query);
      return json({
        etag: current.etag,
        csv: exportProductCsv(products, current.etag),
        query,
        items: products.map((product) => ({ id: product.id, model: product.model, name: product.name, naverPrice: product.naverPrice, stock: product.stock, optionName: product.optionName || '', options: product.options || [], naverDiscountRate: product.naverDiscountRate })),
      }, 200, { Vary: 'Cookie' });
    }
    if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
    const input = await readJson(request, 4_200_000);
    if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ message: 'CSV 요청 형식을 확인해 주세요.' }, 400);
    if (request.method === 'PUT' && normalizeBlobEtag(input.etag) !== normalizeBlobEtag(current.etag)) return json({ message: '제품 목록이 변경되었습니다. 새 CSV를 받은 뒤 다시 반영해 주세요.' }, 409);
    const plan = typeof input.csv === 'string'
      ? planProductCsv(input.csv, current.catalog.products, current.etag, input.etag)
      : planBulkProducts(current.catalog.products, input.updates);
    if (request.method === 'POST') return json({ etag: current.etag, changes: plan.changes, updated: plan.updated, submitted: plan.submitted }, 200, { Vary: 'Cookie' });
    if (!plan.updated) return json({ ok: true, updated: 0, etag: current.etag });
    const saved = await writeProductCatalog({ ...current.catalog, products: plan.products }, current.etag);
    return json({ ok: true, updated: plan.updated, etag: saved.etag });
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) return json({ message: '다른 관리자 작업으로 제품 목록이 변경되었습니다. 다시 내려받아 주세요.' }, 409);
    return json({ message: Number(error.status) < 500 ? error.message : '제품 일괄 작업을 처리하지 못했습니다.', fieldErrors: error.fieldErrors || {} }, Number(error.status) || 500);
  }
}

async function handleRequest(request) {
  const route = new URL(request.url).searchParams.get('route');
  if (route === 'black-friday') return fetchBlackFriday(request);
  if (route === 'promotions') return fetchPromotions(request);
  if (route === 'reviews') return fetchReviews(request);
  if (route === 'members') return fetchMembers(request);
  if (route === 'reels') return fetchReels(request);
  if (route === 'bulk-products') return fetchBulkProducts(request);
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) return methodNotAllowed(['GET', 'POST', 'PATCH', 'DELETE']);
  if (!authIsConfigured() || !productStoreIsConfigured()) return json({ message: '제품 관리 저장소 설정이 완료되지 않았습니다.' }, 503);
  if (!isAdminRequest(request)) return json({ message: '관리자 로그인이 필요합니다.' }, 401, { Vary: 'Cookie' });

  try {
    if (request.method === 'GET') {
      const offset = parseCursor(new URL(request.url).searchParams.get('cursor') || '');
      if (offset < 0) return json({ message: '목록 위치 값이 올바르지 않습니다.' }, 400);
      const { catalog, etag } = await readProductCatalog();
      const query = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 160);
      const ordered = filterAdminProducts(catalog.products, query).slice().sort((first, second) => {
        const firstDate = first.createdAt || '';
        const secondDate = second.createdAt || '';
        return secondDate.localeCompare(firstDate);
      });
      const items = ordered.slice(offset, offset + PAGE_SIZE).map(publicProduct);
      const readiness = {
        inventoryMissing: catalog.products.filter((product) => product.stock === null && !(Array.isArray(product.options) && product.options.length)).length,
        discountMissing: catalog.products.filter((product) => product.naverDiscountRate === null || product.naverDiscountRate === undefined).length,
        highlightsMissing: catalog.products.filter((product) => !Array.isArray(product.highlights) || product.highlights.length < 2).length,
      };
      const nextOffset = offset + items.length;
      return json({
        items,
        query,
        catalogTotal: catalog.products.length,
        total: ordered.length,
        hasMore: nextOffset < ordered.length,
        nextCursor: nextOffset < ordered.length ? String(nextOffset) : null,
        etag,
        readiness,
      }, 200, { Vary: 'Cookie' });
    }

    if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
    const input = await readJson(request, 48_000);
    const current = await readProductCatalog();

    if (request.method === 'POST') {
      const duplicate = current.catalog.products.find((product) => product.requestId && product.requestId === input.requestId);
      if (duplicate) return json({ ok: true, duplicate: true, product: publicProduct(duplicate), etag: current.etag }, 200, { Vary: 'Cookie' });

      const { value, fieldErrors, valid } = validateProductInput(input);
      if (!valid) return json({ message: '입력 내용을 확인해 주세요.', fieldErrors }, 400, { Vary: 'Cookie' });
      const verifiedMedia = await verifyManagedImages(value.requestId, {
        mainImage: value.image,
        gallery: value.gallery,
      });
      value.image = verifiedMedia.mainImage;
      value.gallery = verifiedMedia.gallery;
      value.managedImages = [value.image, ...value.gallery];
      const product = createProductRecord(value, current.catalog.products);
      const saved = await writeProductCatalog({ ...current.catalog, products: [product, ...current.catalog.products] }, current.etag);
      return json({ ok: true, product: publicProduct(product), etag: saved.etag }, 201, { Vary: 'Cookie' });
    }

    const id = typeof input.id === 'string' ? input.id : '';
    const suppliedEtag = input.etag === null || typeof input.etag === 'string' ? input.etag : undefined;
    if (!id || suppliedEtag === undefined || normalizeBlobEtag(suppliedEtag) !== normalizeBlobEtag(current.etag)) {
      const action = request.method === 'PATCH' ? '수정' : '삭제';
      return json({ message: `제품 목록이 변경되었습니다. 새로고침한 뒤 다시 ${action}해 주세요.` }, 409, { Vary: 'Cookie' });
    }
    const product = current.catalog.products.find((item) => item.id === id);
    if (!product) return json({ message: '이미 삭제되었거나 찾을 수 없는 제품입니다.' }, 404, { Vary: 'Cookie' });

    if (request.method === 'PATCH') {
      const { value, fieldErrors, valid } = validateProductUpdateInput(input, product);
      if (!valid) return json({ message: '입력 내용을 확인해 주세요.', fieldErrors }, 400, { Vary: 'Cookie' });

      if (value.managedImages.length) {
        const verifiedMedia = await verifyManagedImages(value.requestId, {
          mainImage: value.replaceMainImage ? value.image : '',
          gallery: value.replaceGallery ? value.gallery : [],
        });
        if (value.replaceMainImage) value.image = verifiedMedia.mainImage;
        if (value.replaceGallery) value.gallery = verifiedMedia.gallery;
        value.managedImages = [verifiedMedia.mainImage, ...verifiedMedia.gallery].filter(Boolean);
      }

      const media = mergeProductMedia(product, value);
      const updatedProduct = updateProductRecord(product, value, media);
      const updatedProducts = current.catalog.products.map((item) => (item.id === id ? updatedProduct : item));
      const saved = await writeProductCatalog({ ...current.catalog, products: updatedProducts }, current.etag);
      let restockNotification = { sent: 0, configured: false };
      try { restockNotification = await notifyRestockSubscribers(publicProduct(updatedProduct)); } catch (error) { console.error('restock_notification_failed', { productId: id, message: error.message || 'unknown error' }); }
      const mediaRemoved = await deleteManagedImages(media.removedManagedImages);
      return json({ ok: true, product: publicProduct(updatedProduct), etag: saved.etag, mediaRemoved, restockNotification }, 200, { Vary: 'Cookie' });
    }

    const remaining = current.catalog.products.filter((item) => item.id !== id);
    const saved = await writeProductCatalog({ ...current.catalog, products: remaining }, current.etag);
    const mediaRemoved = await deleteManagedImages(product.managedImages);
    return json({ ok: true, etag: saved.etag, mediaRemoved }, 200, { Vary: 'Cookie' });
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) {
      return json({ message: '다른 관리자 작업으로 제품 목록이 변경되었습니다. 새로고침한 뒤 다시 시도해 주세요.' }, 409, { Vary: 'Cookie' });
    }
    const status = Number(error.status) || 500;
    console[status >= 500 ? 'error' : 'warn']('product_catalog_mutation_failed', {
      method: request.method,
      status,
      message: error.message || 'unknown error',
    });
    return json({ message: status < 500 ? error.message : '제품 관리 작업을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, status, { Vary: 'Cookie' });
  }
}

export async function fetch(request) { return auditedAdminRequest(request, handleRequest); }

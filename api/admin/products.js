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

const PAGE_SIZE = 20;

function parseCursor(value) {
  if (!value) return 0;
  if (!/^\d{1,6}$/.test(value)) return -1;
  return Number(value);
}

export async function fetch(request) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) return methodNotAllowed(['GET', 'POST', 'PATCH', 'DELETE']);
  if (!authIsConfigured() || !productStoreIsConfigured()) return json({ message: '제품 관리 저장소 설정이 완료되지 않았습니다.' }, 503);
  if (!isAdminRequest(request)) return json({ message: '관리자 로그인이 필요합니다.' }, 401, { Vary: 'Cookie' });

  try {
    if (request.method === 'GET') {
      const offset = parseCursor(new URL(request.url).searchParams.get('cursor') || '');
      if (offset < 0) return json({ message: '목록 위치 값이 올바르지 않습니다.' }, 400);
      const { catalog, etag } = await readProductCatalog();
      const ordered = catalog.products.slice().sort((first, second) => {
        const firstDate = first.createdAt || '';
        const secondDate = second.createdAt || '';
        return secondDate.localeCompare(firstDate);
      });
      const items = ordered.slice(offset, offset + PAGE_SIZE).map(publicProduct);
      const nextOffset = offset + items.length;
      return json({
        items,
        total: ordered.length,
        hasMore: nextOffset < ordered.length,
        nextCursor: nextOffset < ordered.length ? String(nextOffset) : null,
        etag,
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
      const mediaRemoved = await deleteManagedImages(media.removedManagedImages);
      return json({ ok: true, product: publicProduct(updatedProduct), etag: saved.etag, mediaRemoved }, 200, { Vary: 'Cookie' });
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

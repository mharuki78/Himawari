import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_GALLERY_IMAGE_SIZE,
  MAX_MAIN_IMAGE_SIZE,
  createProductRecord,
  mergeProductMedia,
  publicProduct,
  seedCatalog,
  validateProductInput,
  validateProductUpdateInput,
  updateProductRecord,
} from '../api/_lib/products.js';
import { fetch as adminProductsHandler } from '../api/admin/products.js';
import { fetch as productsHandler } from '../api/products.js';

const requestId = '9b3571c6-66cb-4f30-85a7-79ca7486054e';
const imageUrl = `https://example.public.blob.vercel-storage.com/product-media/${requestId}/main.webp`;
const productFields = {
  name: '히마와리 테스트 백팩',
  model: 'No.TEST',
  price: 129000,
  tagline: '하루의 이동을 단정하게 정리하는 백팩',
  description: '노트북과 일상 소지품을 나누어 담을 수 있도록 구성한 테스트용 상세 설명입니다.',
  highlights: ['분리된 수납 구조', '일상과 출근에 어울리는 균형'],
  url: 'https://smartstore.naver.com/baegot/products/123456789',
};

function request(url, method = 'GET', body) {
  return new Request(url, {
    method,
    headers: {
      Origin: new URL(url).origin,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('기존 제품 34개에 안정적인 공개 ID를 부여한다', () => {
  const catalog = seedCatalog();
  assert.equal(catalog.products.length, 34);
  assert.equal(new Set(catalog.products.map((product) => product.id)).size, 34);
  assert.match(catalog.products[0].id, /^store-\d+$/);
});

test('대표 이미지와 상세 이미지의 역할별 업로드 용량을 구분한다', () => {
  assert.equal(MAX_MAIN_IMAGE_SIZE, 8 * 1024 * 1024);
  assert.equal(MAX_GALLERY_IMAGE_SIZE, 15 * 1024 * 1024);
});

test('공개할 제품 이미지와 관계없는 관리 이미지 URL을 함께 제출하면 거부한다', () => {
  const unrelatedImageUrl = `https://example.public.blob.vercel-storage.com/product-media/${requestId}/gallery-2.webp`;
  const result = validateProductInput({
    requestId,
    ...productFields,
    image: imageUrl,
    gallery: [],
    managedImages: [imageUrl, unrelatedImageUrl],
  });

  assert.equal(result.valid, false);
  assert.match(result.fieldErrors.mainImage, /업로드한 이미지만/);
});

test('새 제품 입력 계약을 검증하고 관리자 메타데이터를 공개 응답에서 제외한다', () => {
  const result = validateProductInput({
    requestId,
    ...productFields,
    image: imageUrl,
    gallery: [],
    managedImages: [imageUrl],
  });
  assert.equal(result.valid, true);
  const record = createProductRecord(result.value, []);
  const visible = publicProduct(record);
  assert.equal(visible.name, '히마와리 테스트 백팩');
  assert.equal('requestId' in visible, false);
  assert.equal('managedImages' in visible, false);
});

test('기존 제품 수정은 공개 ID와 기존 이미지를 유지한다', () => {
  const created = createProductRecord(validateProductInput({
    requestId,
    ...productFields,
    image: imageUrl,
    gallery: [],
    managedImages: [imageUrl],
  }).value, []);
  const result = validateProductUpdateInput({
    ...productFields,
    name: '수정한 히마와리 테스트 백팩',
    price: 135000,
    replaceMainImage: false,
    replaceGallery: false,
    managedImages: [],
  });

  assert.equal(result.valid, true);
  const media = mergeProductMedia(created, result.value);
  const updated = updateProductRecord(created, result.value, media);
  assert.equal(updated.id, created.id);
  assert.equal(updated.image, created.image);
  assert.equal(updated.name, '수정한 히마와리 테스트 백팩');
  assert.equal(updated.price, 135000);
});

test('예전 등록 기준의 제품도 기존 값을 유지하면 다른 항목을 수정할 수 있다', () => {
  const legacyProduct = seedCatalog().products[0];
  const result = validateProductUpdateInput({
    ...legacyProduct,
    price: legacyProduct.price + 1_000,
    replaceMainImage: false,
    replaceGallery: false,
    managedImages: [],
  }, legacyProduct);

  assert.equal(legacyProduct.highlights.length, 0);
  assert.equal(result.valid, true);
  assert.deepEqual(result.fieldErrors, {});
});

test('기존 관리 이미지 중 교체한 대표 이미지만 정리 대상으로 분리한다', () => {
  const galleryUrl = `https://example.public.blob.vercel-storage.com/product-media/${requestId}/gallery.webp`;
  const replacementRequestId = 'ab3571c6-66cb-4f30-85a7-79ca7486054e';
  const replacementUrl = `https://example.public.blob.vercel-storage.com/product-media/${replacementRequestId}/main.webp`;
  const created = createProductRecord(validateProductInput({
    requestId,
    ...productFields,
    image: imageUrl,
    gallery: [galleryUrl],
    managedImages: [imageUrl, galleryUrl],
  }).value, []);
  const result = validateProductUpdateInput({
    requestId: replacementRequestId,
    ...productFields,
    replaceMainImage: true,
    replaceGallery: false,
    image: replacementUrl,
    managedImages: [replacementUrl],
  });

  assert.equal(result.valid, true);
  const media = mergeProductMedia(created, result.value);
  assert.equal(media.image, replacementUrl);
  assert.deepEqual(media.gallery, [galleryUrl]);
  assert.deepEqual(media.removedManagedImages, [imageUrl]);
  assert.deepEqual(new Set(media.managedImages), new Set([galleryUrl, replacementUrl]));
});

test('불완전한 제품과 스마트스토어가 아닌 구매 주소를 거부한다', () => {
  const result = validateProductInput({
    requestId,
    name: '',
    model: '',
    price: 0,
    tagline: '짧음',
    description: '짧음',
    highlights: [],
    image: '',
    gallery: [],
    url: 'https://example.com/product',
    managedImages: [],
  });
  assert.equal(result.valid, false);
  assert.deepEqual(
    Object.keys(result.fieldErrors).sort(),
    ['description', 'highlights', 'mainImage', 'model', 'name', 'price', 'tagline', 'url'],
  );
});

test('제품 저장소가 없으면 공개 API가 기존 카탈로그를 제공한다', async () => {
  const previous = process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
  delete process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
  try {
    const response = await productsHandler(request('https://example.test/api/products'));
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.products.length, 34);
    assert.equal('managedImages' in payload.products[0], false);
  } finally {
    if (previous === undefined) delete process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
    else process.env.PRODUCT_BLOB_READ_WRITE_TOKEN = previous;
  }
});

test('관리자 제품 API는 저장소와 인증이 없으면 데이터를 읽지 않는다', async () => {
  const previous = process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
  delete process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
  try {
    const response = await adminProductsHandler(request('https://example.test/api/admin/products'));
    assert.equal(response.status, 503);
  } finally {
    if (previous === undefined) delete process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
    else process.env.PRODUCT_BLOB_READ_WRITE_TOKEN = previous;
  }
});

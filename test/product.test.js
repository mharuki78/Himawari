import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProductRecord,
  publicProduct,
  seedCatalog,
  validateProductInput,
} from '../api/_lib/products.js';
import { fetch as adminProductsHandler } from '../api/admin/products.js';
import { fetch as productsHandler } from '../api/products.js';

const requestId = '9b3571c6-66cb-4f30-85a7-79ca7486054e';
const imageUrl = `https://example.public.blob.vercel-storage.com/product-media/${requestId}/main.webp`;

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

test('새 제품 입력 계약을 검증하고 관리자 메타데이터를 공개 응답에서 제외한다', () => {
  const result = validateProductInput({
    requestId,
    name: '히마와리 테스트 백팩',
    model: 'No.TEST',
    price: 129000,
    tagline: '하루의 이동을 단정하게 정리하는 백팩',
    description: '노트북과 일상 소지품을 나누어 담을 수 있도록 구성한 테스트용 상세 설명입니다.',
    highlights: ['분리된 수납 구조', '일상과 출근에 어울리는 균형'],
    image: imageUrl,
    gallery: [],
    url: 'https://smartstore.naver.com/baegot/products/123456789',
    managedImages: [imageUrl],
  });
  assert.equal(result.valid, true);
  const record = createProductRecord(result.value, []);
  const visible = publicProduct(record);
  assert.equal(visible.name, '히마와리 테스트 백팩');
  assert.equal('requestId' in visible, false);
  assert.equal('managedImages' in visible, false);
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

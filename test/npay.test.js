import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import test from 'node:test';

import {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  buildOrderXml,
  buildProductInformationXml,
  naverOrderResult,
  npayConfiguration,
  npayProductId,
  npayPublicConfiguration,
} from '../api/_lib/npay.js';
import { fetchNpayOrder as orderHandler, fetchNpayProductInformation as productInfoHandler } from '../api/_lib/npay-handlers.js';
import { publicProduct, seedCatalog } from '../api/_lib/products.js';

const ENV_KEYS = ['NPAY_SHOP_ID', 'NPAY_CERTI_KEY', 'NPAY_BUTTON_KEY', 'NPAY_ACCOUNT_ID', 'NPAY_ENV', 'VERCEL_ENV'];

function withEnv(values, work) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  return Promise.resolve()
    .then(work)
    .finally(() => {
      for (const key of ENV_KEYS) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    });
}

function sameOriginRequest(path, body) {
  return new Request(`https://allaboutbag.com${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : {
      Origin: 'https://allaboutbag.com',
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('공개 설정은 버튼 SDK 정보만 제공하고 상점 인증키를 노출하지 않는다', async () => {
  await withEnv({
    NPAY_SHOP_ID: 'himawari-shop',
    NPAY_CERTI_KEY: 'server-only-certificate',
    NPAY_BUTTON_KEY: 'browser-button-key',
    NPAY_ACCOUNT_ID: 'common-account-id',
    NPAY_ENV: 'production',
  }, () => {
    const visible = npayPublicConfiguration();
    assert.equal(visible.enabled, true);
    assert.equal(visible.buttonKey, 'browser-button-key');
    assert.equal(visible.mode, 'production');
    assert.equal(visible.trackingConfigured, true);
    assert.equal(JSON.stringify(visible).includes('server-only-certificate'), false);
    assert.equal(JSON.stringify(visible).includes('himawari-shop'), false);
  });
});

test('주문 XML은 현재 카탈로그 가격과 확정 배송 정책을 사용한다', () => {
  const product = publicProduct(seedCatalog().products[0]);
  const config = { shopId: 'shop-id', certiKey: 'cert-key' };
  const body = buildOrderXml({
    config,
    items: [{ product, quantity: 2 }],
    backUrl: 'https://allaboutbag.com/products.html',
    naverInflowCode: 'naver&amp-test',
  });

  assert.match(body, new RegExp(`<basePrice>${product.price}</basePrice>`));
  assert.match(body, /<quantity>2<\/quantity>/);
  assert.match(body, new RegExp(`<feePrice>${SHIPPING_FEE}</feePrice>`));
  assert.match(body, new RegExp(`<basePrice>${FREE_SHIPPING_THRESHOLD}</basePrice>`));
  assert.match(body, /<feeType>CONDITIONAL_FREE<\/feeType>/);
  assert.match(body, /<naverInflowCode>naver&amp;amp-test<\/naverInflowCode>/);
});

test('상품 정보 XML은 판매 중 상태와 같은 가격·배송 정책을 제공한다', () => {
  const product = publicProduct(seedCatalog().products[0]);
  const body = buildProductInformationXml([product]);
  assert.match(body, new RegExp(`<id>${npayProductId(product)}</id>`));
  assert.match(body, /<status>ON_SALE<\/status>/);
  assert.match(body, /<optionSupport>false<\/optionSupport>/);
  assert.match(body, new RegExp(`<basePrice>${product.price}</basePrice>`));
  assert.match(body, /<shippingPolicy>/);
});

test('네이버 주문 등록 응답은 성공 키와 가맹점 번호를 엄격히 분리한다', () => {
  assert.deepEqual(naverOrderResult('SUCCESS:BUYKEY123:MERCHANT99'), {
    ok: true,
    key: 'BUYKEY123',
    merchantNo: 'MERCHANT99',
  });
  assert.deepEqual(naverOrderResult('FAIL:[E101]잘못된 상품'), { ok: false, code: 'E101' });
});

test('주문 API는 브라우저 가격 대신 서버 상품 가격으로 네이버에 등록한다', async () => {
  const product = publicProduct(seedCatalog().products[0]);
  const originalFetch = globalThis.fetch;
  let registeredXml = '';
  await withEnv({
    NPAY_SHOP_ID: 'himawari-shop',
    NPAY_CERTI_KEY: 'server-certificate',
    NPAY_BUTTON_KEY: 'button-key',
    NPAY_ENV: 'test',
  }, async () => {
    globalThis.fetch = async (_url, options) => {
      registeredXml = options.body;
      return new Response('SUCCESS:BUYKEY123:MERCHANT99');
    };
    try {
      const response = await orderHandler(sameOriginRequest('/api/npay/order', {
        context: 'product',
        items: [{ productId: product.id, quantity: 1, price: 1 }],
      }));
      const payload = await response.json();
      assert.equal(response.status, 200);
      assert.deepEqual(payload, { key: 'BUYKEY123', merchantNo: 'MERCHANT99' });
      assert.match(registeredXml, new RegExp(`<basePrice>${product.price}</basePrice>`));
      assert.doesNotMatch(registeredXml, /<basePrice>1<\/basePrice>/);
      assert.match(registeredXml, /<certiKey>server-certificate<\/certiKey>/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('상품 정보 API는 네이버 상품 ID로 현재 제품 정보를 XML 반환한다', async () => {
  const product = publicProduct(seedCatalog().products[0]);
  const id = encodeURIComponent(npayProductId(product));
  const response = await productInfoHandler(sameOriginRequest(`/api/npay/product-info?product[0][id]=${id}`));
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/xml/);
  assert.match(body, new RegExp(`<id>${npayProductId(product)}</id>`));
  assert.match(body, new RegExp(`<basePrice>${product.price}</basePrice>`));
});

test('주문 API는 외부 사이트에서 보낸 요청을 거부한다', async () => {
  await withEnv({
    NPAY_SHOP_ID: 'himawari-shop',
    NPAY_CERTI_KEY: 'server-certificate',
    NPAY_BUTTON_KEY: 'button-key',
  }, async () => {
    const response = await orderHandler(new Request('https://allaboutbag.com/api/npay/order', {
      method: 'POST',
      headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    }));
    assert.equal(response.status, 403);
  });
});

test('프로덕션 환경은 별도 모드 값이 없어도 서비스 URL을 사용한다', async () => {
  await withEnv({ VERCEL_ENV: 'production', NPAY_ENV: '' }, () => {
    assert.match(npayConfiguration().orderRegistrationUrl, /^https:\/\/api\.pay\.naver\.com\//);
  });
});

test('Npay 공개 경로는 기존 주문 함수 하나로 통합해 Hobby 함수 한도를 지킨다', async () => {
  const files = await readdir(new URL('../api/', import.meta.url), { recursive: true });
  const apiFunctions = files.filter((file) => file.endsWith('.js') && !file.replaceAll('\\', '/').startsWith('_lib/'));
  assert.equal(apiFunctions.length, 12);
});

import test from 'node:test';
import assert from 'node:assert/strict';
const feed = await import('../api/_lib/npay-order-feed.js').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
const collect = (...args) => { assert.equal(typeof feed.collectNpayChanges, 'function', 'order feed reader missing'); return feed.collectNpayChanges(...args); };
const detail = (...args) => { assert.equal(typeof feed.readNpayOrderMetadata, 'function', 'order metadata reader missing'); return feed.readNpayOrderMetadata(...args); };
const from = '2026-11-13T00:00:00.000+09:00';
const to = '2026-11-13T01:00:00.000+09:00';
const changed = (id, date) => ({ productOrderId: id, orderId: 'fixture-order', lastChangedDate: date, productOrderStatus: 'PAYED' });

test('changed-order reader follows provider cursors with a fixed inclusive end and does not assert collection finality', async () => {
  const result = await collect({ from, to, request: async (path, options) => {
    const u = new URL(path, 'https://example.invalid');
    assert.equal(options.method, 'GET');
    assert.equal(u.pathname, '/v1/pay-order/mall/product-orders/last-changed-statuses');
    assert.equal(u.searchParams.get('lastChangedTo'), to);
    if (!u.searchParams.has('moreSequence')) {
      assert.equal(u.searchParams.get('lastChangedFrom'), from);
      return { traceId: 'fixture', data: { count: 1, lastChangeStatuses: [changed('one', from)], more: { moreFrom: from, moreSequence: 'provider-cursor' } } };
    }
    assert.equal(u.searchParams.get('moreSequence'), 'provider-cursor');
    return { traceId: 'fixture', data: { count: 1, lastChangeStatuses: [changed('two', to)] } };
  } });
  assert.deepEqual(result.productOrderIds, ['one', 'two']);
  assert.equal(result.through, to);
  assert.equal(result.collectionFinal, false);
});

test('malformed pages and repeated provider cursors fail rather than silently advancing a watermark', async () => {
  await assert.rejects(collect({ from, to, request: async () => ({ data: { count: 0 } }) }));
  await assert.rejects(collect({ from, to, request: async () => ({ data: { count: 0, lastChangeStatuses: [], more: { moreFrom: from, moreSequence: 'loop' } } }) }));
  const empty = await collect({ from, to, request: async () => ({ data: { count: 0, lastChangeStatuses: [] } }) });
  assert.deepEqual(empty.productOrderIds, []);
  assert.equal(empty.collectionFinal, false);
});

test('detail reader batches at 300, returns only settlement metadata and preserves missing IDs as unresolved', async () => {
  const ids = Array.from({ length: 301 }, (_, i) => 'fixture-' + i);
  const result = await detail({ productOrderIds: ids, request: async (path, options) => {
    assert.equal(path, '/v1/pay-order/mall/product-orders/query');
    assert.equal(options.method, 'POST');
    assert.ok(options.body.productOrderIds.length <= 300);
    return { data: options.body.productOrderIds.filter(id => id !== 'fixture-300').map(id => ({
      order: { orderId: 'fixture-order', ordererName: 'SYNTHETIC_PRIVATE_NAME', ordererTel: 'SYNTHETIC_PRIVATE_PHONE' },
      productOrder: { productOrderId: id, productId: 'NPR-0123456789abcdef01234567', productOrderStatus: 'PAYED',
        initialQuantity: 2, remainQuantity: 2, unitPrice: 39000, optionPrice: 0, optionManageCode: 'OPT-fixture',
        shippingAddress: { baseAddress: 'SYNTHETIC_PRIVATE_ADDRESS' } },
      completedClaims: [],
    })) };
  } });
  assert.equal(result.orders.length, 300);
  assert.deepEqual(result.missingProductOrderIds, ['fixture-300']);
  assert.equal(result.orders[0].productOrderId, 'fixture-0');
  assert.equal(result.orders[0].initialQuantity, 2);
  assert.equal(result.orders[0].unitPrice, 39000);
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_PRIVATE/);
  assert.equal(result.collectionFinal, false);
});

test('a count discrepancy does not advance the polling watermark', async () => {
  const result = await collect({ from, to, request: async () => ({ data: { count: 1, lastChangeStatuses: [] } }) });
  assert.equal(result.through, null);
  assert.equal(result.coverageComplete, false);
  assert.equal(result.collectionFinal, false);
});

test('malformed change and claim entries produce the bounded API error', async () => {
  await assert.rejects(collect({ from, to, request: async () => ({ data: { count: 1, lastChangeStatuses: [null] } }) }), { status: 502 });
  await assert.rejects(detail({ productOrderIds: ['fixture'], request: async () => ({ data: [{
    productOrder: { productOrderId: 'fixture', productId: 'fixture-product', productOrderStatus: 'PAYED' }, completedClaims: [null],
  }] }) }), { status: 502 });
  await assert.rejects(detail({ productOrderIds: ['fixture'], request: async () => ({ data: [{
    productOrder: { productOrderId: 'fixture', productId: 'fixture-product', productOrderStatus: 'PAYED' },
    completedClaims: { claimStatus: 'CANCEL_DONE', requestQuantity: 1 },
  }] }) }), { status: 502 });
});

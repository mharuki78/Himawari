import test from 'node:test';
import assert from 'node:assert/strict';
import { blackFridayView } from '../black-friday/view.js';
import * as pricing from '../black-friday/pricing.js';

const items = [49900, 39000, 29999, 30000, 40000].map((price, i) => ({
  offerId: '00000000-0000-4000-8000-00000000000' + i,
  name: 'Test bag ' + i, price, regularPrice: 59000, remaining: i === 0 ? 0 : 1,
}));
const event = { state: 'open', startsAt: '2026-11-27T00:00:00Z', serverTime: '2026-11-27T01:00:00Z', endsAt: '2026-11-27T02:00:00Z', items };

test('links populated price bands to the first matching cards in one sale-price-ordered grid', () => {
  const { content, schema } = blackFridayView(event);
  const [navigation, products] = content.split('</nav>');
  const jumps = [...navigation.matchAll(/href="#bf-price-(\d+)">(\d+)만원대/g)];
  assert.deepEqual(jumps.map(match => match.slice(1)), [['2', '2'], ['3', '3'], ['4', '4']]);
  assert.equal([...products.matchAll(/data-bf-products/g)].length, 1);
  assert.doesNotMatch(products, /만원대|<section/);
  const cards = [...products.matchAll(/<article([^>]*)>[\s\S]*?<h2[^>]*><a[^>]*>([^<]+)<\/a>/g)];
  assert.deepEqual(cards.map(([, attrs, name]) => [attrs.match(/id="([^"]+)"/)?.[1], name]), [
    ['bf-price-2', 'Test bag 2'],
    ['bf-price-3', 'Test bag 3'],
    [undefined, 'Test bag 1'],
    ['bf-price-4', 'Test bag 4'],
    [undefined, 'Test bag 0'],
  ]);
  assert.deepEqual(schema.mainEntity.itemListElement.map(x => x.name), ['Test bag 2', 'Test bag 3', 'Test bag 1', 'Test bag 4', 'Test bag 0']);
  assert.match(content, /34%/);
  assert.match(content, /행사 수량 소진/);
  const closed = blackFridayView({ ...event, serverTime: event.endsAt });
  assert.doesNotMatch(closed.content, /39,000원|bf-price-3|34%/);
  assert.equal(closed.schema.mainEntity, undefined);
});

test('calculates a whole-won offer from a percentage and displays the discount from the actual price', () => {
  assert.equal(pricing.salePriceForRate(59000, 30), 41300);
  assert.equal(pricing.salePriceForRate(75999, 40), 45599);
  assert.equal(pricing.salePriceForRate(2, 99), 1);
  assert.equal(pricing.salePriceForRate(59000, 0), null);
  assert.equal(pricing.salePriceForRate(59000, 100), null);
  assert.equal(pricing.discountPercent(59000, 39000), 34);
  assert.equal(pricing.discountPercent(59000, 58999), 0);
  assert.equal(pricing.discountPercent(59000, 59000), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderXml, buildProductInformationXml } from '../api/_lib/npay.js';

const fixture = () => ({
  id: 'NPR-0123456789abcdef01234567', physicalProductId: 'physical-bag',
  name: 'Fixture & bag', image: 'https://example.invalid/bag.webp',
  price: 39000, stock: 2, npaySaleStatus: 'ON_SALE',
  optionName: '색상', options: [{ id: 'blue', label: '블루', stock: 2 }],
});

test('reservation XML keeps the opaque Npay identity but links to the physical product', () => {
  const output = buildProductInformationXml([fixture()]);
  assert.match(output, /<id>NPR-0123456789abcdef01234567<\/id>/);
  assert.match(output, /<infoUrl>https:\/\/himawari.co.kr\/product.html\?id=physical-bag<\/infoUrl>/);
  assert.match(output, /<basePrice>39000<\/basePrice>/);
});

test('retired reservation XML blocks purchase and disables every allocated option', () => {
  const output = buildProductInformationXml([{ ...fixture(), npaySaleStatus: 'NOT_SALE' }]);
  assert.match(output, /<status>NOT_SALE<\/status><stockQuantity>0<\/stockQuantity>/);
  assert.match(output, /<combination>.*<stockQuantity>0<\/stockQuantity><status>false<\/status>/);
  assert.doesNotMatch(output, /<status>true<\/status>/);
});

test('stock exhaustion remains distinct from permanently retired reservation XML', () => {
  const output = buildProductInformationXml([{ ...fixture(), npaySaleStatus: 'SOLD_OUT' }]);
  assert.match(output, /<status>SOLD_OUT<\/status><stockQuantity>0<\/stockQuantity>/);
  assert.doesNotMatch(output, /<status>true<\/status>/);
});

test('order registration refuses a retired reservation instead of emitting its old price', () => {
  const product = { ...fixture(), npaySaleStatus: 'NOT_SALE' };
  assert.throws(() => buildOrderXml({ config: { shopId: 'fixture', certiKey: 'fixture' },
    items: [{ product, quantity: 1, option: product.options[0] }], backUrl: 'https://example.invalid/' }), { status: 409 });
});

test('invalid internal reservation sale states fail closed', () => {
  assert.throws(() => buildProductInformationXml([{ ...fixture(), npaySaleStatus: 'unknown' }]), { status: 409 });
});

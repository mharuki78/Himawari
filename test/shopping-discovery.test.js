import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeCompareIds } from '../assets/compare-store.js';
import { productPurchaseFacts, parseExternalDimensions, productEvidenceHighlights } from '../assets/product-facts.js';
import { productVariantKind } from '../assets/catalog-tools.js';
import { renderProductPage } from '../api/_lib/storefront.js';

test('comparison selection preserves order, removes duplicates and unsafe IDs, and never exceeds three', () => {
  assert.deepEqual(normalizeCompareIds(['one','one','<bad>','two','three','four']), ['one','two','three']);
  assert.deepEqual(normalizeCompareIds(null), []);
});
test('size reference uses complete positive metric dimensions and never invents missing values', () => {
  assert.deepEqual(parseExternalDimensions('30 × 45 × 20 cm'), [30,45,20]);
  for (const value of ['', '미확인', '15인치', '30 × 45', '0 × 45 × 20', '300 × 450 × 200 mm']) assert.equal(parseExternalDimensions(value), null);
  assert.deepEqual(productPurchaseFacts({specs:{weight:'850 g'}}), [{key:'weight',label:'무게',value:'850 g'}]);
  assert.deepEqual(productEvidenceHighlights({highlights:['무조건 방수']}), []);
});
test('color, size, and set controls distinguish actual catalog labels', () => {
  assert.equal(productVariantKind({name:'Himawari No.1884 블랙'}), '색상');
  assert.equal(productVariantKind({name:'Himawari No.1884 블랙M'}), '크기');
  assert.equal(productVariantKind({name:'Himawari No.1027+체스트벨트 SET'}), '구성');
});
test('server-rendered purchase evidence matches the selected variant and remains escaped', async () => {
  const template=await readFile(new URL('../templates/product.html',import.meta.url),'utf8');
  const p={id:'safe',name:'제품',model:'No.1234',price:89000,tagline:'',description:'',highlights:[],gallery:[],image:'https://example.com/bag.jpg',specs:{weight:'500 g',material:'나일론 <script>alert(1)</script>'}};
  const html=renderProductPage(template,p,'https://himawari.co.kr',{aggregate:{count:12,ratingValue:4.8},reviews:[]});
  assert.match(html,/data-purchase-facts>[\s\S]*?500 g/);
  assert.match(html,/data-quick-review>4.8점 · 리뷰 12개/);
  assert.match(html,/나일론 &lt;script&gt;/);
  assert.match(html,/id="product-shipping"/);
  assert.match(html,/href="product.html\?id=safe#product-specifications"/);
  assert.match(html,/href="product.html\?id=safe#product-reviews"/);
  assert.doesNotMatch(html,/href="#product-/);
  assert.doesNotMatch(html,/<p>나일론 <script>/);
});

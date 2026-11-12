import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { neonConfig } from '@neondatabase/serverless';
import { validateCartItems, readMemberCart, replaceMemberCart } from '../api/_lib/member-store.js';
import { ensureOrderSchema } from '../api/_lib/orders.js';
import { saveBlackFriday, readPublicBlackFriday, blackFridayCatalogRows } from '../api/_lib/black-friday.js';
import { seedCatalog, publicProduct } from '../api/_lib/products.js';

// Exercise the real Neon SQL against isolated PostgreSQL; never load .env or a live catalog.
test('member cart persists regular edits alongside expired BF identity without a misleading sync failure', async () => {
  const db = new PGlite();
  const oldFetch = neonConfig.fetchFunction;
  const names = ['DATABASE_URL', 'BLOB_READ_WRITE_TOKEN', 'PRODUCT_BLOB_READ_WRITE_TOKEN'];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.DATABASE_URL = 'postgresql://fixture:fixture@fixture.invalid/member-cart';
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
  const pgText = value => value === null ? null : value instanceof Date ? value.toISOString().replace('T', ' ').replace(/Z$/, '+00') : typeof value === 'object' ? JSON.stringify(value) : typeof value === 'boolean' ? (value ? 't' : 'f') : String(value);
  neonConfig.fetchFunction = async (_url, { body }) => {
    const input = JSON.parse(body);
    const run = async (tx, query, params) => {
      const { fields, rows } = await tx.query(query, params);
      return { fields, rows: rows.map(row => fields.map(field => pgText(row[field.name]))) };
    };
    try {
      return Response.json(input.queries ? { results: await db.transaction(async tx => {
        const results = [];
        for (const query of input.queries) results.push(await run(tx, query.query, query.params));
        return results;
      }) } : await run(db, input.query, input.params));
    } catch (error) { return Response.json({ message: error.message, code: error.code }, { status: 400 }); }
  };
  try {
    await db.exec(`CREATE TABLE users (id text PRIMARY KEY);
      CREATE TABLE cart_items (user_id text, product_id text, quantity integer, created_at timestamptz DEFAULT now(), PRIMARY KEY(user_id, product_id));`);
    await ensureOrderSchema();
    const rows = blackFridayCatalogRows(seedCatalog().products.map(publicProduct));
    const product = rows.find(row => row.regularPrice > 1000 && (row.stock === null || row.stock >= 4));
    const normal = rows.find(row => row.productId !== product.productId && (row.stock === null || row.stock >= 2));
    assert.ok(product && normal);
    const kst = ms => new Date(ms + 9 * 3600_000).toISOString().slice(0, 16);
    await saveBlackFriday({ revision: 0, enabled: true, startsAt: kst(Date.now() - 3600_000), endsAt: kst(Date.now() + 3600_000),
      items: [{ productId: product.productId, optionId: product.optionId, price: 1000, quantity: 3 }] });
    const event = await readPublicBlackFriday({ prepareOrders: ensureOrderSchema });
    const blackFriday = { offerId: event.items[0].offerId, unitPrice: 1000 };
    const sale = { productId: product.productId, optionId: product.optionId, quantity: 2, blackFriday };
    const regular = { productId: normal.productId, optionId: normal.optionId, quantity: 1 };
    const validated = await validateCartItems([sale, regular]);
    assert.deepEqual(validated.items, [sale, regular], 'validation must retain campaign intent');
    const restored = await replaceMemberCart('synthetic-member', validated.items);
    assert.equal(restored.length, 2);
    assert.deepEqual(restored[0].blackFriday, blackFriday);
    assert.equal(restored[0].product.price, 1000);
    assert.equal(restored[0].stock, 3);
    assert.equal(restored[0].blackFridayUnavailable, false);
    assert.equal(restored[1].product.price, normal.regularPrice);
    assert.equal(restored[1].blackFriday, undefined);
    const stored = (await db.query('SELECT product_id FROM cart_items ORDER BY created_at')).rows;
    assert.equal(stored[1].product_id, normal.optionId ? `${normal.productId}::${normal.optionId}` : normal.productId, 'legacy regular IDs stay compatible');
    await assert.rejects(validateCartItems([sale, { ...sale, blackFriday: undefined }]), { status: 400 });
    for (const invalid of [null, {}, { offerId: '', unitPrice: 1000 }, { offerId: blackFriday.offerId, unitPrice: '1000' }, { offerId: blackFriday.offerId, unitPrice: 0 }]) {
      await assert.rejects(validateCartItems([{ ...sale, blackFriday: invalid }]), { status: 400 });
    }
    await db.exec('UPDATE black_friday_campaign SET ends_at=clock_timestamp()');
    const stale = (await readMemberCart('synthetic-member'))[0];
    assert.deepEqual(stale.blackFriday, blackFriday);
    assert.equal(stale.blackFridayUnavailable, true);
    assert.equal(stale.product.price, 1000, 'closed offers retain locked price instead of silently becoming regular');
    assert.equal(stale.stock, 0);
    const h = memberHarness({
      onFetch: async (url, options) => {
        try {
          if (url === '/api/black-friday') return { ok: true, json: async () => ({ state: 'closed', items: [] }) };
          const items = options.method === 'PUT'
            ? await replaceMemberCart('synthetic-member', (await validateCartItems(JSON.parse(options.body).items)).items)
            : await readMemberCart('synthetic-member');
          return { ok: true, json: async () => ({ items }) };
        } catch (error) { return { ok: false, status: error.status, json: async () => ({ message: error.message }) }; }
      },
    });
    await h.api.merge();
    h.editQuantity(normal.productId, 2);
    await h.api.send();
    const after = await readMemberCart('synthetic-member');
    assert.equal(after.find(item => item.productId === normal.productId).quantity, 2, 'ordinary edit must persist despite expired BF line');
    const preserved = after.find(item => item.productId === product.productId);
    assert.deepEqual(preserved.blackFriday, blackFriday);
    assert.equal(preserved.blackFridayUnavailable, true);
    assert.equal(preserved.product.price, 1000);
    assert.deepEqual(h.toasts(), [], 'successful stale-intent saves must not show the generic retry toast');
    assert.deepEqual((await validateCartItems([{ ...sale, quantity: 4 }])).items[0].blackFriday, blackFriday,
      'saved purchase intent may exceed remaining quota; checkout revalidates it');
    const stalePrice = { ...sale, blackFriday: { ...blackFriday, unitPrice: 999 } };
    const staleValidated = await validateCartItems([stalePrice]);
    const staleRestored = await replaceMemberCart('synthetic-price-member', staleValidated.items);
    assert.equal(staleRestored[0].product.price, 999);
    assert.equal(staleRestored[0].blackFridayUnavailable, true);
    await assert.rejects(validateCartItems([{ ...regular, optionId: 'invented-option' }]), { status: 400 });
    await assert.rejects(validateCartItems([{ ...sale, optionId: 'invented-option' }]), { status: 400 });
  } finally {
    neonConfig.fetchFunction = oldFetch;
    for (const [name, value] of Object.entries(saved)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    await db.close();
  }
});

test('optionless product rejects an unmatched option ID instead of inventing a second SKU', async () => {
  const product = seedCatalog().products.map(publicProduct).find(item => !item.options.length && item.stock !== 0);
  await assert.rejects(validateCartItems([{ productId: product.id, optionId: 'invented-option', quantity: 1 }]), { status: 400 });
});

function memberHarness({ server = [], local = [], sameOwner = false, event = { state: 'open', items: [] }, onFetch } = {}) {
  let current = structuredClone(local);
  const requests = [];
  const toastNodes = [];
  const context = vm.createContext({
    window: { SiteCart: { items: () => structuredClone(current), replace: items => { current = structuredClone(items); } } },
    document: { readyState: 'loading', addEventListener() {}, querySelector() { return toastNodes[0] || null; }, createElement() { return { dataset: {}, setAttribute() {}, classList: { add() {}, remove() {} } }; }, body: { appendChild(node) { toastNodes.push(node); } } },
    localStorage: { getItem: key => key === 'himawari-cart-owner' && sameOwner ? 'synthetic-member' : null, setItem() {} },
    fetch: async (url, options = {}) => {
      requests.push({ url, options });
      if (onFetch) return onFetch(url, options);
      return { ok: true, json: async () => url === '/api/black-friday' ? event : { items: server } };
    },
    setTimeout() {}, clearTimeout() {}, location: { pathname: '/cart.html' },
  });
  const source = readFileSync(new URL('../assets/member.js', import.meta.url), 'utf8').replace('window.HimawariMember = {',
    'window.testMember = { merge: mergeMemberCart, send: sendCart, serialize: cartItemsForServer, signIn: function () { state.authenticated = true; state.user = { id: "synthetic-member" }; } }; window.HimawariMember = {');
  vm.runInContext(source, context);
  context.window.testMember.signIn();
  return { api: context.window.testMember, items: () => JSON.parse(JSON.stringify(current)), requests,
    editQuantity(productId, quantity) { current.find(item => item.id === productId).q = quantity; }, toasts: () => toastNodes.map(node => node.textContent) };
}

const offer = { productId: 'bag', optionId: 'green', offerId: 'offer-fixture', price: 1000, remaining: 3 };
const saleMeta = { offerId: offer.offerId, unitPrice: 1000 };
const regularLocal = { id: 'bag', optionId: 'green', name: 'Bag', price: 5000, q: 2, stock: 8 };
const saleServer = { productId: 'bag', optionId: 'green', optionLabel: 'Green', quantity: 2, stock: 3, blackFriday: saleMeta,
  product: { name: 'Bag', price: 1000, url: '' } };

test('login merge preserves BF context, caps duplicate quantities by quota and syncs per-line metadata', async () => {
  const h = memberHarness({ server: [saleServer], local: [regularLocal], event: { state: 'open', items: [offer] } });
  await h.api.merge();
  const items = h.items();
  assert.equal(items.length, 1);
  assert.deepEqual(items[0].blackFriday, saleMeta);
  assert.equal(items[0].price, 1000);
  assert.equal(items[0].q, 3);
  assert.equal(items[0].stock, 3);
  const put = h.requests.find(request => request.options.method === 'PUT');
  assert.deepEqual(JSON.parse(put.options.body).items, [{ productId: 'bag', optionId: 'green', quantity: 3, blackFriday: saleMeta }]);
});

test('login merge upgrades regular server line with valid local BF and preserves quantity for same owner', async () => {
  const local = { ...regularLocal, price: 1000, q: 1, blackFriday: saleMeta };
  const server = { ...saleServer, quantity: 2, blackFriday: undefined, product: { ...saleServer.product, price: 5000 } };
  const h = memberHarness({ server: [server], local: [local], sameOwner: true, event: { state: 'open', items: [offer] } });
  await h.api.merge();
  assert.equal(h.items()[0].q, 2);
  assert.deepEqual(h.items()[0].blackFriday, saleMeta);
  assert.equal(h.items()[0].price, 1000);
});

test('login merge keeps stale BF identity and price when same SKU also exists as a regular line', async () => {
  const h = memberHarness({ server: [{ ...saleServer, blackFridayUnavailable: true }], local: [regularLocal], event: { state: 'closed', items: [] } });
  await h.api.merge();
  assert.deepEqual(h.items()[0].blackFriday, saleMeta);
  assert.equal(h.items()[0].price, 1000);
  assert.equal(h.items()[0].blackFridayUnavailable, true);
  assert.equal(h.items()[0].stock, 0);
});

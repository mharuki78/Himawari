import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { neonConfig } from '@neondatabase/serverless';
import { npayOptionManageCode } from '../api/_lib/npay.js';

const settlement = await import('../api/_lib/npay-settlement.js').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
const alias = 'NPR-0123456789abcdef01234567';
const otherAlias = 'NPR-abcdef0123456789abcdef01';
const reservation = (extra = {}) => ({ id: alias, checkout_id: 'checkout', option_id: '', quantity: 5,
  held_quantity: 5, unit_price: 10000, ...extra });
const order = (extra = {}) => ({ orderId: 'fixture-order', productOrderId: 'fixture-line', productId: alias,
  optionManageCode: '', productOrderStatus: 'PAYED', initialQuantity: 3, remainQuantity: 3,
  unitPrice: 10000, optionPrice: 0, quantityConfirmed: true, claimType: '', claimStatus: '',
  paymentDate: '2026-11-13T12:00:00+09:00', completedClaims: [], ...extra });
const claim = (id, quantity) => ({ claimId: id, claimType: 'CANCEL', claimStatus: 'CANCEL_DONE',
  requestQuantity: quantity, claimCompleteOperationDate: '2026-11-13T13:00:00+09:00' });
const project = (...args) => {
  assert.equal(typeof settlement.projectNpayOrderSettlement, 'function', 'Npay settlement projection is missing');
  return settlement.projectNpayOrderSettlement(...args);
};

test('paid, delivered and returned evidence retains the entire allocated quantity', () => {
  for (const status of ['PAYED', 'DELIVERING', 'DELIVERED', 'PURCHASE_DECIDED', 'RETURNED']) {
    const result = project(reservation(), order({ productOrderStatus: status }));
    assert.equal(result.valid, true);
    assert.equal(result.heldQuantity, 5);
  }
});

test('identity, option, price, quantity and unknown states fail closed', () => {
  for (const change of [
    { productId: otherAlias }, { optionManageCode: 'wrong' }, { unitPrice: 9999 }, { optionPrice: 1 },
    { initialQuantity: 0 }, { initialQuantity: 6, remainQuantity: 6 }, { quantityConfirmed: false },
    { remainQuantity: 4 }, { productOrderStatus: 'NEW_UNKNOWN_STATE' }, { claimStatus: 'NEW_UNKNOWN_CLAIM' },
    { orderId: '' }, { productOrderId: '' }, { completedClaims: [claim('a', 4)] },
  ]) assert.equal(project(reservation(), order(change)).valid, false, JSON.stringify(change));
  assert.equal(project(reservation({ option_id: 'blue' }), order()).valid, false);
  assert.equal(project(reservation({ option_id: 'blue' }), order({
    optionManageCode: npayOptionManageCode({ id: alias }, { id: 'blue' }),
  })).valid, true);
});

test('verified cancellation only releases purchased units and retains the unused allocation', () => {
  assert.equal(project(reservation(), order({ productOrderStatus: 'CANCELED', remainQuantity: 0 })).heldQuantity, 2);
  assert.equal(project(reservation(), order({ claimType: 'CANCEL', claimStatus: 'CANCEL_DONE', remainQuantity: 0 })).heldQuantity, 2);
  assert.equal(project(reservation(), order({ remainQuantity: 1, claimType: 'CANCEL', claimStatus: 'CANCEL_REQUEST' })).heldQuantity, 5);
  assert.equal(project(reservation(), order({ remainQuantity: 1, completedClaims: [claim('one', 2), claim('one', 2)] })).heldQuantity, 3);
  assert.equal(project(reservation(), order({ completedClaims: [claim('one', 2), claim('one', 1)] })).valid, false);
  assert.equal(project(reservation(), order({ completedClaims: [{ ...claim('return', 3), claimType: 'RETURN', claimStatus: 'RETURN_DONE' }] })).heldQuantity, 5);
});

test('cancellation evidence is monotonic across replay, missing claims and stale paid snapshots', () => {
  const first = project(reservation(), order({ remainQuantity: 1, completedClaims: [claim('a', 2)] }));
  const nextReservation = reservation({ held_quantity: 3 });
  const replay = project(nextReservation, order(), first.line);
  assert.equal(replay.heldQuantity, 3);
  const more = project(nextReservation, order({ remainQuantity: 0, completedClaims: [claim('b', 1)] }), first.line);
  assert.equal(more.heldQuantity, 2);
  assert.equal(project(nextReservation, order({ completedClaims: [claim('a', 1)] }), first.line).valid, false);
  const terminal = project(reservation(), order({ productOrderStatus: 'CANCELED', remainQuantity: 0 }));
  const stale = project(reservation({ held_quantity: 2 }), order(), terminal.line);
  assert.equal(stale.heldQuantity, 2);
  assert.equal(stale.line.product_order_status, 'CANCELED');
  assert.equal(project(nextReservation, order({ initialQuantity: 2, remainQuantity: 2 }), first.line).valid, false);
});

test('inconsistent completed claim quantity cannot release a unit', () => {
  assert.equal(project(reservation(), order({ completedClaims: [claim('a', 2)] })).valid, false);
  assert.equal(project(reservation(), order({ remainQuantity: 0,
    completedClaims: [claim('a', 2), claim('b', 2)] })).valid, false);
  assert.equal(project(reservation(), order({ remainQuantity: 1,
    completedClaims: [{ ...claim('a', 2), claimCompleteOperationDate: '' }] })).valid, false);
});

test('mixed return and cancellation quantities never restock returned merchandise', () => {
  const returned = { ...claim('returned', 2), claimType: 'RETURN', claimStatus: 'RETURN_DONE' };
  const mixed = order({ remainQuantity: 0, claimType: 'CANCEL', claimStatus: 'CANCEL_DONE',
    completedClaims: [returned, claim('canceled', 1)] });
  const first = project(reservation(), mixed);
  assert.equal(first.valid, true);
  assert.equal(first.heldQuantity, 4);
  const after = reservation({ held_quantity: 4 });
  const missingReturns = project(after, order({ remainQuantity: 0, claimType: 'CANCEL', claimStatus: 'CANCEL_DONE' }), first.line);
  assert.equal(missingReturns.valid, true);
  assert.equal(missingReturns.heldQuantity, 4);
  const staleFullStatus = project(after, order({ productOrderStatus: 'CANCELED', remainQuantity: 0 }), first.line);
  assert.equal(staleFullStatus.heldQuantity, 4);
});

test('a completed claim ID cannot change its type or quantity within or across polls', () => {
  const returned = { ...claim('same-id', 2), claimType: 'RETURN', claimStatus: 'RETURN_DONE' };
  assert.equal(project(reservation(), order({ remainQuantity: 0, completedClaims: [returned, claim('same-id', 1)] })).valid, false);
  assert.equal(project(reservation(), order({ remainQuantity: 0, completedClaims: [returned, { ...returned, requestQuantity: 1 }] })).valid, false);
  const first = project(reservation(), order({ remainQuantity: 1, completedClaims: [returned] }));
  assert.equal(first.valid, true);
  assert.equal(project(reservation(), order({ remainQuantity: 0, completedClaims: [claim('same-id', 2)] }), first.line).valid, false);
  const canceled = project(reservation(), order({ remainQuantity: 1, completedClaims: [claim('same-id', 2)] }));
  assert.equal(project(reservation({ held_quantity: 3 }), order({ remainQuantity: 0, completedClaims: [returned] }), canceled.line).valid, false);
});

test('verified no-payment cancellation status retains stock without completed cancel quantities', () => {
  const first = project(reservation(), order({ productOrderStatus: 'CANCELED_BY_NOPAYMENT', remainQuantity: 0 }));
  assert.equal(first.valid, true);
  assert.equal(first.heldQuantity, 5);
  const stale = project(reservation(), order(), first.line);
  assert.equal(stale.valid, true);
  assert.equal(stale.heldQuantity, 5);
  assert.equal(stale.line.product_order_status, 'CANCELED_BY_NOPAYMENT');
  const completed = project(reservation(), order({ productOrderStatus: 'CANCELED_BY_NOPAYMENT', remainQuantity: 0,
    completedClaims: [claim('cancel-proof', 1)] }));
  assert.equal(completed.valid, true);
  assert.equal(completed.heldQuantity, 4);
});

test('administrator cancellation releases only validated completed quantities with stable claim identity', () => {
  for (const status of ['ADMIN_CANCELING', 'ADMIN_CANCEL_REJECT']) {
    const result = project(reservation(), order({ remainQuantity: 0, claimType: 'ADMIN_CANCEL', claimStatus: status }));
    assert.equal(result.valid, true);
    assert.equal(result.heldQuantity, 5);
  }
  assert.equal(project(reservation(), order({ remainQuantity: 0, claimType: 'ADMIN_CANCEL', claimStatus: 'ADMIN_CANCEL_DONE' })).heldQuantity, 2);
  const admin = { ...claim('admin-id', 1), claimType: 'ADMIN_CANCEL', claimStatus: 'ADMIN_CANCEL_DONE' };
  const first = project(reservation(), order({ remainQuantity: 2, completedClaims: [admin, admin] }));
  assert.equal(first.valid, true);
  assert.equal(first.heldQuantity, 4);
  const replay = project(reservation({ held_quantity: 4 }), order({ remainQuantity: 2, completedClaims: [admin] }), first.line);
  assert.equal(replay.valid, true);
  assert.equal(replay.heldQuantity, 4);
  assert.equal(project(reservation({ held_quantity: 4 }), order({ remainQuantity: 2,
    completedClaims: [claim('admin-id', 1)] }), first.line).valid, false);
  const returned = { ...claim('returned', 2), claimType: 'RETURN', claimStatus: 'RETURN_DONE' };
  const mixed = project(reservation(), order({ remainQuantity: 0, claimType: 'ADMIN_CANCEL', claimStatus: 'ADMIN_CANCEL_DONE',
    completedClaims: [admin, returned] }));
  assert.equal(mixed.valid, true);
  assert.equal(mixed.heldQuantity, 4);
  assert.equal(project(reservation(), order({ claimStatus: 'ADMIN_UNKNOWN' })).valid, false);
});

test('authenticated metadata reconciliation binds once, preserves stock and rolls back atomically', async t => {
  assert.equal(typeof settlement.reconcileNpayOrderMetadata, 'function', 'Npay metadata reconciler is missing');
  const db = new PGlite();
  const oldFetch = neonConfig.fetchFunction;
  const oldUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://fixture:fixture@fixture.invalid/npay-settlement';
  const pgText = value => value === null ? null : value instanceof Date ? value.toISOString() :
    typeof value === 'object' ? JSON.stringify(value) : typeof value === 'boolean' ? value ? 't' : 'f' : String(value);
  neonConfig.fetchFunction = async (_url, { body }) => {
    const { queries, query, params } = JSON.parse(body);
    const run = async (sql, text, values) => {
      const { fields, rows } = await sql.query(text, values);
      return { fields, rows: rows.map(row => fields.map(field => pgText(row[field.name]))) };
    };
    try {
      return Response.json(queries ? { results: await db.transaction(async tx => {
        const results = [];
        for (const q of queries) results.push(await run(tx, q.query, q.params));
        return results;
      }) } : await run(db, query, params));
    } catch (error) { return Response.json({ message: error.message, code: error.code }, { status: 400 }); }
  };
  const reset = async () => {
    await db.exec('TRUNCATE npay_checkouts CASCADE');
    await db.query("INSERT INTO npay_checkouts(id,request_id,fingerprint,phase) VALUES('checkout','request','fingerprint','registered')");
    for (const [id, option] of [[alias, ''], [otherAlias, 'blue']]) await db.query(
      'INSERT INTO npay_inventory_reservations(id,checkout_id,product_id,option_id,quantity,held_quantity,unit_price,regular_price,snapshot) VALUES($1,\'checkout\',\'physical\',$2,5,5,10000,20000,\'{}\')', [id, option]);
  };
  const held = async id => (await db.query('SELECT held_quantity FROM npay_inventory_reservations WHERE id=$1', [id])).rows[0].held_quantity;
  const reconcile = (...args) => settlement.reconcileNpayOrderMetadata(...args);
  try {
    await settlement.ensureNpaySettlementSchema();
    await t.test('unknown aliases and empty polls never release; purchase evidence blocks alias reuse', async () => {
      await reset();
      await reconcile([]);
      const ignored = await reconcile([order({ productId: 'legacy-product' }), order({ productId: 'NPR-111111111111111111111111' })]);
      assert.equal(ignored.ignored, 2);
      const result = await reconcile([order({ extraPrivateField: 'DO_NOT_PERSIST_FIXTURE' })]);
      assert.equal(result.bound, 1);
      assert.equal(await held(alias), 5);
      assert.equal((await db.query('SELECT phase FROM npay_checkouts')).rows[0].phase, 'blocked');
      assert.doesNotMatch(JSON.stringify((await db.query('SELECT * FROM npay_provider_lines')).rows), /DO_NOT_PERSIST_FIXTURE|paymentDate|2026-11-13T12/);
      assert.doesNotMatch(JSON.stringify(result), /fixture-order|fixture-line|NPR-/);
    });
    await t.test('mismatches cannot change holds or bind provider lines', async () => {
      await reset();
      const result = await reconcile([order({ unitPrice: 1 })]);
      assert.equal(result.incidents.length, 1);
      assert.equal(await held(alias), 5);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM npay_provider_lines')).rows[0].n, 0);
    });
    await t.test('sandbox metadata cannot mutate production reservations', async () => {
      await reset();
      await db.query("UPDATE npay_checkouts SET environment='production'");
      const result = await reconcile([order({ productOrderStatus: 'CANCELED', remainQuantity: 0 })], { environment: 'sandbox' });
      assert.equal(result.incidents.length, 1);
      assert.equal(await held(alias), 5);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM npay_provider_lines')).rows[0].n, 0);
      assert.equal((await db.query('SELECT phase FROM npay_checkouts')).rows[0].phase, 'registered');
      await reconcile([order({ productOrderStatus: 'CANCELED', remainQuantity: 0 })], { environment: 'production' });
      assert.equal(await held(alias), 2);
      await assert.rejects(reconcile([order()], { environment: 'unknown' }), { status: 400 });
    });
    await t.test('a provider line and a reservation each have only one binding', async () => {
      await reset(); await reconcile([order()]);
      assert.equal((await reconcile([order({ productOrderId: 'other-line' })])).incidents.length, 1);
      assert.equal((await reconcile([order({ productId: otherAlias, optionManageCode: npayOptionManageCode({ id: otherAlias }, { id: 'blue' }) })])).incidents.length, 1);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM npay_provider_lines')).rows[0].n, 1);
      assert.equal(await held(otherAlias), 5);
    });
    await t.test('partial cancellation replay and stale paid evidence cannot increase or repeat release', async () => {
      await reset();
      const partial = order({ remainQuantity: 1, completedClaims: [claim('a', 2)] });
      await Promise.all([reconcile([partial]), reconcile([partial])]);
      assert.equal(await held(alias), 3);
      await reconcile([order()]);
      assert.equal(await held(alias), 3);
      await reconcile([order({ productOrderStatus: 'CANCELED', remainQuantity: 0 })]);
      await reconcile([order()]);
      assert.equal(await held(alias), 2);
      assert.equal((await db.query('SELECT product_order_status FROM npay_provider_lines')).rows[0].product_order_status, 'CANCELED');
    });
    await t.test('mixed returns and cancellation evidence persist without restocking returned units', async () => {
      await reset();
      const returned = { ...claim('returned', 2), claimType: 'RETURN', claimStatus: 'RETURN_DONE' };
      const mixed = order({ remainQuantity: 0, claimType: 'CANCEL', claimStatus: 'CANCEL_DONE',
        completedClaims: [returned, claim('canceled', 1)] });
      await reconcile([mixed]);
      assert.equal(await held(alias), 4);
      await reconcile([order({ remainQuantity: 0, claimType: 'CANCEL', claimStatus: 'CANCEL_DONE' })]);
      assert.equal(await held(alias), 4);
      const invalid = await reconcile([order({ remainQuantity: 0, completedClaims: [claim('returned', 2)] })]);
      assert.equal(invalid.incidents.length, 1);
      assert.equal(await held(alias), 4);
    });
    await t.test('administrator partial cancellation and no-payment states persist safely across polls', async () => {
      await reset();
      await reconcile([order({ productOrderStatus: 'CANCELED_BY_NOPAYMENT', remainQuantity: 0 })]);
      assert.equal(await held(alias), 5);
      const admin = { ...claim('admin-id', 1), claimType: 'ADMIN_CANCEL', claimStatus: 'ADMIN_CANCEL_DONE' };
      await reconcile([order({ productOrderStatus: 'CANCELED_BY_NOPAYMENT', remainQuantity: 0, completedClaims: [admin] })]);
      assert.equal(await held(alias), 4);
      await reconcile([order({ productOrderStatus: 'CANCELED_BY_NOPAYMENT', remainQuantity: 0, completedClaims: [admin, admin] })]);
      assert.equal(await held(alias), 4);
      const result = await reconcile([order({ productOrderStatus: 'CANCELED_BY_NOPAYMENT', remainQuantity: 0,
        completedClaims: [{ ...admin, claimStatus: 'ADMIN_UNKNOWN' }] })]);
      assert.equal(result.incidents.length, 1);
      assert.equal(await held(alias), 4);
    });
    await t.test('competing provider order IDs cannot buy the same reserved alias twice', async () => {
      await reset();
      const results = await Promise.all([reconcile([order()]), reconcile([order({ productOrderId: 'competitor' })])]);
      assert.equal(results.reduce((n, result) => n + result.bound, 0), 1);
      assert.equal(results.reduce((n, result) => n + result.incidents.length, 0), 1);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM npay_provider_lines')).rows[0].n, 1);
      assert.equal(await held(alias), 5);
    });
    await t.test('mixed ordinary and campaign aliases reconcile independently', async () => {
      await reset();
      await db.query("UPDATE npay_inventory_reservations SET campaign_id='campaign',offer_id='offer' WHERE id=$1", [otherAlias]);
      await reconcile([order({ productOrderStatus: 'CANCELED', remainQuantity: 0 }), order({ productOrderId: 'second-line', productId: otherAlias,
        optionManageCode: npayOptionManageCode({ id: otherAlias }, { id: 'blue' }), productOrderStatus: 'RETURNED' })]);
      assert.equal(await held(alias), 2);
      assert.equal(await held(otherAlias), 5);
    });
    await t.test('a SQL failure rolls back provider binding, checkout blocking and quantity release together', async () => {
      await reset();
      await db.exec(`CREATE FUNCTION fixture_fail_release() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.id='${otherAlias}' THEN RAISE EXCEPTION 'fixture failure'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER fixture_release_failure BEFORE UPDATE ON npay_inventory_reservations FOR EACH ROW EXECUTE FUNCTION fixture_fail_release()`);
      try {
        await assert.rejects(reconcile([order({ productOrderStatus: 'CANCELED', remainQuantity: 0 }),
          order({ productId: otherAlias, productOrderId: 'second-line', productOrderStatus: 'CANCELED', remainQuantity: 0,
            optionManageCode: npayOptionManageCode({ id: otherAlias }, { id: 'blue' }) })]));
        assert.equal(await held(alias), 5);
        assert.equal((await db.query('SELECT count(*)::int AS n FROM npay_provider_lines')).rows[0].n, 0);
        assert.equal((await db.query('SELECT phase FROM npay_checkouts')).rows[0].phase, 'registered');
      } finally { await db.exec('DROP TRIGGER fixture_release_failure ON npay_inventory_reservations; DROP FUNCTION fixture_fail_release()'); }
    });
  } finally {
    neonConfig.fetchFunction = oldFetch;
    oldUrl === undefined ? delete process.env.DATABASE_URL : process.env.DATABASE_URL = oldUrl;
    await db.close();
  }
});

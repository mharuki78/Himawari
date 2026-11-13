# Npay sandbox lifecycle verification — approval scope

Prepared 2026-11-13 Asia/Seoul. This is a proposed live sandbox test, not a passed test or production activation record.

## Three proposed test checkouts

Use the actual public product images and server prices, rechecked immediately before registration:

1. Ordinary No.1884 light gray: 118,000 KRW ×1.
2. Campaign No.1027 lavender 49,000 KRW ×1 + No.0422 blue 39,000 KRW ×1: 88,000 KRW.
3. Mixed: No.1027 lavender 49,000 KRW ×2 + No.0422 blue 39,000 KRW ×1 + ordinary No.1884 light gray 118,000 KRW ×1: 255,000 KRW.

These are test order display amounts. The official Npay sandbox uses a virtual PG and does not charge real funds: https://developers.pay.naver.com/support/faq/order . Actual charge: KRW 0; no recurring charge. No payment-card information will be read or saved. Use the official sandbox test-card procedure; stop if any production payment page or real charge appears.

## Operations

- Configure issued Npay sandbox credentials and the existing Fixie proxy in branch-specific Vercel preview secrets; do not publish keys or copy them into Git/chat/logs.
- Use the empty, separate database `himawari_npay_sandbox_20261113`. No production customer records were copied. Keep production catalog/prices/quota unchanged.
- Register the three test baskets with reserved aliases and open their official test checkout URLs. Verify product/option/quantity, 70,000-KRW shipping threshold, original/sale prices and totals.
- Complete sandbox test payments; query only these test orders and the small test time window. Test full and partial sandbox cancellation, duplicate results, selected-quantity changes and corresponding held stock. Do not create production orders or perform production cancellations/refunds.
- Names, account identifiers, contact numbers or saved addresses may appear in the logged-in Naver checkout or sandbox responses. Process transiently on the current device and in the server reader; never copy raw values into files/chat/Git/screenshots. Prefer fictional test recipient/delivery values.
- Store only test order identifiers, state, product/option, quantity, prices, completed-claim identifiers and processing timestamps in the isolated test database. BUY_KEY is encrypted. No raw customer/address/contact payloads are stored.
- Save only safe verification counts/status/field presence and synthetic/nonpersonal UI captures. Do not send external inspection inquiries until a concrete verified submission is ready and separately authorized.

## What remains after a successful test

Provider inspection and production API issuance, production polling/proxy capacity decision, controlled legacy checkout cutover, deployment and real public desktop/mobile readiness verification. The free proxy currently allows 500 requests/month, so continuous production polling capacity has not been approved or configured.

Implementation and tests: `docs/superpowers/plans/2026-11-13-npay-activation.md`, `logs/2026-11-13-npay-activation.md`. Existing settings-only approval and prior four-request sandbox read approval did not authorize the above lifecycle operations or identifier storage.

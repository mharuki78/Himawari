# Black Friday Shopping Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement the independent tasks below. Root stages and commits only task-owned files after review.

**Goal:** Raise the campaign selection limit and make full product details and a persistent cart work with verified Black Friday prices.
**Architecture:** Extend the existing plain JavaScript cart, product renderer and PostgreSQL order validation. Keep one cart/order line per product+option. Preserve optional per-line `blackFriday: { offerId, unitPrice }` through all storage and request boundaries, accepting the old top-level direct-buy payload too. Attribute campaign quota to discounted lines, never to unrelated regular-price lines in the same order.
**Tech Stack:** Existing Node ESM, Vercel, Neon/PostgreSQL, PGlite, plain JS/CSS; no new dependencies.
**Spec:** User's three requests in this chat; requirements and implementation rulings below.

## Global Constraints

- Campaign selection limit: 1,000 entries; existing per-SKU quantity limits remain unchanged. Raise admin request bound to 512,000 bytes.
- Existing product prices, inventory, campaign IDs, offer IDs, dates and banner remain unchanged by this task.
- Cart item shape is `{id,name,price,q,url,optionId,optionLabel,stock,blackFriday?:{offerId,unitPrice}}`; order/member-cart intent uses `{productId,optionId,quantity,blackFriday?:{offerId,unitPrice}}`.
- One SKU per cart/order. BF and regular duplicates must not permit stock/quota evasion; adding an active BF offer to a regular line can upgrade its price when aggregate quantity fits. Adding the same regular SKU to an existing BF line retains the better BF context and its stricter quota.
- Mixed distinct regular and BF SKUs can be ordered together; any order containing a BF line keeps existing no-coupon/Npay-unavailable policy. Existing bank-transfer/KakaoPay validation and >=70,000 KRW shipping policy remain authoritative.
- Expired, stale-price or depleted offers never silently become a regular-price purchase. All BF prices and remaining quantities are checked by server and inside the inventory transaction.
- Do not inspect actual customer/member/order records, create live orders or invoke real payments. All purchase tests use synthetic isolated fixtures. Existing publication automation is outside scope.
- Preserve unrelated dirty AGENTS.md, DESIGN.md and STATE.md; only root integrates status. No worker commits or pushes from this shared checkout.

## Review Focus

- Stale/expired offers in local storage or a returning member cart retain explicit BF identity and block checkout with a useful message.
- Multi-item last-unit races and cancellation restore every reserved SKU and never partially persist an order.
- Mixed normal lines never consume campaign quota, including SKUs later added to the campaign.
- Exact request replay is idempotent; changed SKU, quantity, offer or unit price conflicts.
- Full details show real gallery/specification/reviews, correct BF actions and schema; normal product pages stay unchanged.

### Task 1 — Order validation and quota attribution

**Owner/files:** backend worker: api/_lib/orders.js, black-friday.js, order-transactions.js if necessary, new backend helpers and test/black-friday-cart-orders.test.js.
- [ ] Write and run failing isolated PGlite tests for multi-BF/mixed pricing, stale rollback, quota race/cancellation and replay identity.
- [ ] Implement per-line offer validation, compatible schema fields and line-specific quota accounting; no destructive migration or historical data rewrite.
- [ ] Keep legacy single-offer payload and tests working; run relevant order/coupon/Kakao tests and self-review.

### Task 2 — Persistent member-cart metadata

**Owner/files:** member worker: api/_lib/member-store.js, assets/member.js, test/black-friday-member-cart.test.js; helper files only when needed.
- [ ] Write failing round-trip/merge tests for normal and BF cart identities.
- [ ] Preserve metadata in existing composite cart storage or additive fields without rewriting historical cart contents. Validate BF data using current public campaign; retain unavailable identity for explicit checkout rejection.
- [ ] Preserve same-SKU invariant and existing member merging; run relevant cart tests.

### Task 3 — Full Black Friday product details

**Owner/files:** detail worker: api/storefront.js, api/_lib/storefront.js, product-detail.js, templates/product.html; new helper and test/black-friday-product-detail.test.js.
- [ ] Reuse the full normal product template for an active `/black-friday/item/<offerId>/` so existing 商品정보 links open complete details rather than a thin buy card.
- [ ] Render verified BF price/quota, full real description/gallery/specs and BF checkout/cart controls. Expose cart data attribute `data-black-friday-offer-id`; cart script reads unit price from `data-price`.
- [ ] Revalidate in client refresh, block expired/unavailable offers, hide Npay for BF context and keep normal pages unchanged. Keep Product schema canonical/price/availability/validThrough consistent.
- [ ] Write failing tests first; run relevant storefront/detail tests and report.

### Task 4 — Cart and checkout UI, campaign limit, integration

**Owner/files:** root: assets/cart.js, checkout.js, npay.js, payment-return.js, checkout/cart/event CSS as needed, black-friday/view.js + event.js, admin limit UI, admin API request cap, affected template script versions, tests and task log.
- [ ] Preserve metadata in add/restore/replace/storage event and checkout intent; add collection cart controls with accessible success/failure feedback.
- [ ] Resolve every BF checkout line from the live event, preserve locked price identity, block stale/depleted lines; hide coupons/Npay for BF-containing checkout.
- [ ] Preserve purchase identity on completion and prevent normal cart remnants/discount loss.
- [ ] Run relevant tests, independent review and Chrome PC/mobile interaction verification using isolated purchase data.
- [ ] Commit/push only owned changes; verify exact production READY and public detail/cart flow without submitting a live order. Save receipt and update STATE.

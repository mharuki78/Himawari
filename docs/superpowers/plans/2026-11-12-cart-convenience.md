# Cart Convenience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Steps use checkbox syntax.

**Goal:** Ship all five approved cart/checkout conveniences with mobile verification.
**Architecture:** Shared pure summary and variant helpers; classic cart is bundled from a source entry with existing esbuild. Selection stays local and full-cart synchronization stays unchanged. Checkout reuses shared benefits/shipping policy and its existing submit flow.
**Tech Stack:** Existing vanilla JS, CSS, esbuild, node:test, Chrome Playwright; existing daisyUI/Anime.js system retained.
**Spec:** docs/superpowers/plans/2026-11-12-cart-convenience-spec.md

## Global Constraints
- Shipping3,500 KRW; free shipping threshold70,000 KRW; quantities1–99 and stock/offer quota.
- Preserve Black Friday purchase identity, exclusion of campaign coupons/Npay, and server revalidation.
- Full cart remains in member synchronization; selected subset alone proceeds to order/Npay.
- No real orders, payments, production configuration writes or existing personal data access.
- Stage only owned files, preserve unrelated AGENTS/DESIGN/STATE edits.

## Review Focus
- Empty/partial selection, silent member restore and stale Npay callback must not purchase unselected items.
- Variant collision/stock shortage/changed offer must be atomic and retain original cart on rejection.
- Campaign savings and coupons must not be subtracted twice; shipping boundaries must match policy.
- Excluded or expired campaign rows must not block ordinary selected purchase.
- Mobile sticky bar must not cover fields/keyboard/modal/complete views or submit before choosing payment.

### Task 1: Shared money and option rules
Files: assets/order-summary.js, assets/cart-options.js, test/cart-convenience.test.js.
Interfaces: orderBenefits(lines,{discountAmount,shippingFee}) => subtotal,campaignSavings,couponSavings,totalSavings,shippingFee,total,remaining,progress; variantChoices(item,products,event), replaceCartOption(cart,index,choice).
- [x] RED: 69,999/70,000 shipping; 127,000 campaign saving at212,800 subtotal; coupon savings without duplicate deduction; variant family/options; offer expiry; collision and insufficient stock unchanged.
- [x] GREEN: implement using existing shipping-policy and catalog family helpers.
- [x] Verify focused node:test and commit helper deliverable.

### Task 2: Selected cart and option editor
Files: assets/cart.source.js, generated assets/cart.js, assets/cart.css, package.json, assets/npay.js, relevant tests.
Consumes Task1 helpers. Produces SiteCart.selectedItems() while items() remains full.
- [x] RED: old cart defaults selected; subset/none/all; selected checkout payload; selection survives silent restore; selection affects Npay callback; variant UI validation.
- [x] GREEN: bundle existing classic cart entry via build:cart; toolbar/checks, summary/progress, inline variant picker and safe merge; Npay reads selectedItems.
- [x] Verify node tests and Chrome selected/option scenarios; commit deliverable.

### Task 3: Checkout benefits and mobile action
Files: assets/checkout.js, checkout.html, assets/checkout-layout.css, test/discovery-checkout-disclosure.test.js.
Consumes orderBenefits and existing checkoutCartLine saleDisplay.
- [x] RED: campaign+coupon savings, quantity update, free shipping state, mobile action chooser versus existing form submission and expired state.
- [x] GREEN: render informational savings, shipping progress and fixed mobile action; preserve actual totals and payment lifecycle.
- [x] Verify full npm test; preserve test-only sitemap ordering; fresh whole-change review; fix important findings with RED/GREEN.

### Task 4: Production delivery
Files: logs/2026-11-12-cart-convenience.md; ignored backups/cart-convenience-2026-11-12/*; STATE local status.
- [x] Chrome desktop1440/mobile390+320: selection, delete, same-model colour/option switch, quota rejection, threshold, total, reload, mixed checkout, mobile bar and keyboard/focus.
- [x] Commit only owned files, push origin/main, verify exact commit production READY and hashes.
- [x] Repeat read-only production interactions; save native mobile captures and receipt; update authoritative STATE and report verified result.

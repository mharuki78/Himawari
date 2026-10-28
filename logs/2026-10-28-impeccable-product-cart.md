# Product/cart audit fixes

Date: 2026-10-28, Asia/Seoul. Worker: fix_product_cart. Task ID: impeccable-product-cart-20261028. Integration owner: root controller; this worker does not change STATE.md, commit, push or deploy.

User authorization, relayed by controller: resolve the nine audit findings and deploy. This worker owns findings 1, 3 and 7 in `docs/audits/impeccable-2026-10-28.md`.

Implementation choices and execution:

- Cart drawer is inert at construction and after close; opening removes inert before focusing its close button. Existing page locking, Tab loop, Escape and focus restoration remain. CSS visibility is a fallback for browsers without inert support.
- Native details/summary wraps the existing purchase controls and official payment container. It starts collapsed at widths up to 600px and open on larger screens. Price and purchase action remain visible; Escape closes and focuses summary. ResizeObserver updates reserved page space and scroll padding. Responsive changes preserve inventory/quantity state.
- Mobile shell reserves a 44px utility row for the existing cart and support launchers, with selected item/quantity text alongside it. Their scoped CSS no longer positions them over product copy. Closed shell targets 110px; browser measurement is pending controller verification.
- Native selects, sibling-product navigation, quantity limits, cart data and all Npay/Kakao/bank links reuse the original inventory function. No payment SDK appearance or order-registration behavior is changed.
- Product guidance uses a zero-minimum mobile grid track and shrinkable figure; spec labels and captions can wrap without forcing 320px overflow.

Files: `assets/cart.js`, `assets/cart.css`, `product-detail.js`, `templates/product.html`, `assets/purchase-bar.css`, `assets/product-guidance.css`, `test/cart-drawer-access.test.mjs`, `test/product-purchase-controls.test.mjs`.

Verification observed:

- `node --test test/purchase-quantity.test.js test/product-purchase-controls.test.mjs test/cart-drawer-access.test.mjs`: 6 passed, 0 failed. Covers drawer inert lifecycle and focus loop/restoration, disclosure Escape/viewport changes, state retention, stock clamping, all payment/cart quantity data, native option syncing and sibling navigation quantity.
- `node --test test/storefront.test.js test/product.test.js`: 35 passed, 0 failed. Existing storefront renderer/metadata and product contracts remain intact.
- `git diff --check`: passed after core changes.
- Impeccable detector ran once on the six changed UI/source files. It reported only advisory palette/radius findings from existing styles and official Kakao color. Template stylesheet resolution is incomplete because detector resolves template-relative links without its base URL.

Unverified here: actual Chrome layout at 320/390/768/1440, native Tab exclusion/rendering, official Npay visibility when first expanded, screen-reader output, physical-device behavior and real payment. Controller owns the shared Chrome and batched UI inspection. No browser actions or live order/payment requests were performed by this worker.

Next: controller integrates, verifies the affected product/cart flows in Chrome, records consolidated status, and deploys the verified result. No unrelated files were staged or reset.

Follow-up from controller Chrome inspection: dynamically appended `assets/assistant.css` overrode the mobile support-host bottom position because both rules had equal specificity. Strengthened the mobile selector to `body.product-detail-page .support-assistant`; its utility-row position now wins independently of stylesheet order. No assistant colors changed. Source inspection confirmed Npay retains its config/SDK and product-ready paths with an `npayReady` duplicate-mount guard. Controller's SDK review found ResizeObserver handling for a zero-width mount; without a reproduced SDK failure, Npay lifecycle was left unchanged. Controller will wait for config/SDK readiness before checking the first expanded button.

# Himawari audit fixes implementation plan

> For agentic workers: Execute the independent domains using superpowers:dispatching-parallel-agents; integrate and verify using superpowers:verification-before-completion.

**Goal:** Resolve all nine findings in docs/audits/impeccable-2026-10-28.md and publish the verified commit through the existing GitHub/Vercel production connection.

**Architecture:** Preserve the existing HTML templates, vanilla JavaScript and CSS tokens. Change disclosure and loading boundaries rather than replace product, payment or content data. Keep each worker's file ownership separate; the controller integrates and checks the whole customer journey.

**Tech Stack:** HTML/CSS, browser JavaScript modules, Node test runner, Vercel server-rendered storefront, FFmpeg, Chrome/Playwright.

**Spec:** docs/audits/impeccable-2026-10-28.md and the user's approval to fix every item and deploy to Git/Vercel.

## Global constraints

- Preserve product photos, specifications, prices, inventory, article bodies, dates and URLs; no generated images or new editorial publication.
- Preserve the sage/forest brand, official payment button appearance and all three payment methods.
- Keep search/category/sort/reset, selected product/variant/quantity, cart and payment links functional.
- Do not stage unrelated untracked files or others' work. Current main equals origin/main at a96028db5b6fe14e5d58ff38d3d4d87bb0d5416b.
- No real order creation, payment, account or project setting changes. Production deployment is authorized.
- Browser owner is the controller; workers use bounded source/unit checks and do not control shared Chrome.

## Review focus

- Hidden and reopened cart: keyboard focus must stay visible, open focus trap and restoration must still work.
- Purchase controls: options, quantities, unavailable stock and all payment methods must survive mobile collapse/expand.
- Checkout with and without payment query: selected bank opens the form directly; users can still change methods.
- Pagination after search/category/reset: search covers every article, newly revealed cards are usable, URLs and post metadata stay intact.
- Media at reduced motion, hidden tab and viewport exit: stop background playback without breaking manual play or sound controls.

## Tasks

- [x] 1. Product/cart domain — assets/cart.js/css, product-detail.js, templates/product.html, assets/purchase-bar.css, assets/product-guidance.css and narrowly scoped tests. Remove closed cart from focus order; collapse mobile purchase controls behind an accessible summary/primary action; prevent chat overlap; fix 320px intrinsic overflow. Verify quantity/payment/cart regressions and 320/390/768/1440 layouts.
- [x] 2. Discovery/checkout domain — templates/products.html, assets/shopping-refinements.css, assets/checkout.js, assets/checkout-layout.css, checkout.html, products.js only if needed, and scoped tests. Make mobile first product and its name/price visible earlier by folding secondary controls; present an explicitly selected payment method first with a change action. Verify categories, sort, reset, URL state and all method transitions.
- [x] 3. Story domain — story/blog.js, story/index.html, story/index-layout.css, new small pure pagination helper if needed and scoped tests. Render 12 results initially, offer a clear remaining-count load-more action, search/filter the complete data and reset the window after criteria change. Preserve article content and feed/schema timestamps.
- [x] 4. Home/media domain — index.html, script.js, assets/gear.css, new optimized mobile video assets and scoped tests. Keep text fully opaque; fade media only. Raise actionable microtype to at least 12px. Create smaller mobile MP4 variants from existing approved videos, defer offscreen source loading and pause outside viewport/hidden tab/reduced-motion. Preserve poster/manual play.
- [x] 5. Integration — inspect diffs; run relevant tests then npm test once; correct failures caused by the change. Use a task-owned local server with existing storefront renderer and safe read-only production API fixtures if required.
- [x] 6. Batched Chrome verification — check every fixed finding across desktop/mobile, keyboard/cart, purchase options/quantity, method change, catalog filters, story search/load-more and media lifecycle. Save JSON/screenshots under backups/ui-fixes-2026-10-28/. Fix observed issues in one batch and confirm once.
- [x] 7. Final polish/review — verify brand, contrast, compact controls, focus, overflow and reduced motion. Inspect an independent whole-change review and resolve material findings.
- [ ] 8. Commit/deploy — stage only named task files; git diff --check; commit and push main. Prefer the existing automatic production deployment. If Git integration does not create one, use the same exact SHA/project/team through Vercel MCP; do not change project settings.
- [ ] 9. Production verification — confirm exact commit is READY with production alias, verify affected desktop/mobile flows and asset loading on himawari.co.kr, save provider response and receipt, update HIA status and report result.

## Completion evidence

Task log: logs/2026-10-28-impeccable-fixes.md. Browser, media and deployment evidence: backups/ui-fixes-2026-10-28/. Final deployment response must match the pushed commit and production target. UI completion does not imply real payment or physical-device testing.

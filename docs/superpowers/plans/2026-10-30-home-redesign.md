# Himawari home redesign implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Apply the approved refined colour concept to the homepage and public site chrome while preserving commerce and publication features, then deploy the verified commit.

**Architecture:** Retain static HTML, current DOM hooks and server-rendered catalogue templates. Add a final public theme stylesheet, a scoped daisyUI build and an Anime.js browser module. Colour choices consume the existing catalogue request; product data and checkout remain authoritative in existing services.

**Tech stack:** HTML, CSS, JavaScript modules, npm, esbuild, Anime.js 4, daisyUI 5, Tailwind 4.

**Spec:** ../specs/2026-10-30-home-redesign-design.md

## Global constraints

- White background, original product colours/photos and local Pretendard; coherent Phosphor line icons, 44px targets and minimum 12px labels.
- Preserve prices, inventory, authentication, payment settings, orders and all existing public routes. No real transactions.
- Preserve story article bytes, approved photos, dates, schema, RSS and first-publication evidence.
- Respect reduced motion, native hidden semantics and keyboard/focus behaviour.
- User approved implementation, Git push and production deployment; continue without further approval. Reuse current checkout and stage only task-owned files.

## Review focus

- Missing/unsafe catalogue entries: exclude invalid choices and retain a working product link.
- Rapid colour changes and failed images: latest selection wins; label/link/photo remain consistent.
- Header initialization order: member/cart listeners survive decoration; all eight routes and external stores remain reachable.
- 320px and tablet headers: no horizontal overflow; menus close with Escape and restore focus.
- Shared styles: checkout, product variants, story metadata and admin remain functional.

### Task 1: Catalogue-backed colour selection

**Files:** create assets/home-colours.js, test/home-colours.test.mjs; modify products.js.
**Interfaces:** `getHomeColourChoices(products)` returns validated `{id,label,colour,tint,image,name,href}` choices. `getCatalogProducts()` memoizes the existing normalized catalogue request, resets after failure.

User refinement: `getHomeHeroSelection(products,{previousModel,random})` chooses an eligible actual model and its current variants; `getHomeColourChoices(products,model)` now includes model identity and luminance-derived check colour. Exclude immediately previous model when another is available; handle single/empty catalogue. Header lists all eight links with no More. Remove journal pencil source/CSS. These refinements were tested RED→GREEN and in Chrome; 279 total tests pass.

- [x] Add tests for verified mappings, missing entries, unsafe photos, wrong model and duplicate IDs. Run and observe failure before implementation.
- [x] Implement pure validation and request reuse. Run targeted tests green.

### Task 2: Approved homepage and public UI

**Files:** index.html, script.js, assets/member.js, public HTML heads and templates; new assets/site-ui.source.js, assets/site-redesign.css, assets/ui-system.source.css, scoped compiled CSS/JS, icons/font and licences; package files.
**Interfaces:** `data-home-colours` owns colour buttons, photo, model/colour label, detail link and status; existing featured/grid/story/video/cart/member markers remain unchanged.

- [x] Back up article/data hashes and run baseline suite.
- [x] Install compatible libraries; build prefixed daisyUI buttons without preflight, bundle Anime.js. Use local runtime assets.
- [x] Replace initial hero, retain original videos and all downstream functions, restyle remaining homepage sections and public headers/buttons/footer.
- [x] Add latest-request image handling, accessible selection, error/retry and reduced-motion cleanup. Menu retains all links, native more disclosure and mobile Escape/focus.
- [x] Run build, functional tests, article/data hash comparison and full test suite.

### Task 3: Browser validation and final review

**Files:** private backups/home-redesign-2026-10-30 evidence, DESIGN.md, .impeccable/design.json, work log and state.

- [x] Chrome initial batch: 320/390/768/1440px, colour/keyboard/race/error, menu/search/member/cart, product/catalogue, story/lookbook/contact and checkout entry; reduced motion.
- [x] Fix observed issues, recheck affected flows; fresh review of implementation and screenshots.
- [x] Update design records from actual implementation and preserve unrelated work.

### Task 4: Git and production

- [ ] Review diff and stage explicit task-owned files; commit and push main.
- [ ] Preserve Vercel provider response proving exact commit production READY.
- [ ] Check actual production desktop/mobile, live catalogue/photos/links/RSS and key interactions. Refresh publication receipt only if needed, without replacing first evidence or times.
- [ ] Record verified result and report live URL/commit succinctly.

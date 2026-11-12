# Product names and mobile home — 2026-11-12

Task ID: product-names-mobile-2026-11-12. Owner: Codex /root. Timezone: Asia/Seoul.

## User decisions and scope

- Add model/name search and bulk product-name editing to the existing admin price/stock CSV workflow.
- Normalize the catalog's Naver/Coupang titles to the user's current Naver Smart Store export, `C:/Users/UserK/Downloads/Product_20261112_085901.csv` (195 product rows).
- Repair the clipped mobile category menu and place the home bag photograph before the text and color controls on mobile.
- Prepare the exact mapping and a tested local result for review before production application. No new production commit, push, deployment, or catalog mutation has been performed in this task.

## Implementation

- Shared authenticated server-side search filters model, title, product ID, existing variant tagline, and option label before pagination. CSV downloads include all matching products, including those beyond the current 20-row page. Registration counts and readiness metrics continue to describe the entire catalog.
- CSV `제품명` is editable. Repeated option rows must agree on the name; blank names retain the existing name. Name length and all other fields use existing product validation. Preview renders strings as text and marks name rows for wrapping; stale-file detection, one-write compare-and-swap, stock reservations, and unsaved-editor guards remain active.
- Existing formula-escaped names round-trip without accidental apostrophes; newly typed literal names are preserved. Existing legacy stock-only CSV behavior remains supported.
- Name-only batches preserve product IDs, models, prices, registered quantities, options, images, gallery, descriptions, URL, specifications, and related IDs. For six Naver aggregate titles (1682/2301), the existing per-variant color in the tagline remains the color fallback.
- Mobile navigation inherited a short height, and the header's backdrop filter established the wrong containing block for its fixed menu. On mobile/tablet the header no longer establishes that containing block; the menu explicitly fills the remaining dynamic viewport and scrolls independently. All eight categories and the member trigger remain reachable.
- The hero photograph precedes the copy in HTML. Desktop grid positions retain copy left/photo right; mobile uses photo first. Existing image decode, color selection, and reduced-motion behavior remain.

## Naver name plan

Authoritative source is the uploaded current seller export, not successful live Naver browsing. Public Naver detail access was restricted; no login/challenge was attempted. Only product data was used.

- Current public catalog: 148 products, revision 53.
- 145 matched verbatim to the export: 114 title changes and 31 already matching.
- 139 full variant matches and six shared model titles. Exact source row, Naver ID, title field, identity proof, and image evidence are recorded per product.
- Three unmatched products retain their current names: No.124 orange (`coupang-9e8b28e0fab8e07a`), No.124 peach (`coupang-b23b0b50ccf14af8`), No.9290 (`coupang-4861cd80cf7fce0c`). No substitute title was invented.
- 0514 regular/mini identities and 1884M are protected by ID/source evidence; neither names nor suffix matching are used to merge those products.

Review: `backups/product-names-mobile-2026-11-12/reviewed-name-changes.csv` and `research/naver-title-review-all-148.csv`. Exact name-only application plan: `name-updates.json` (status `prepared-not-applied`). Full provenance: `research/naver-export-title-mapping.json` and `research/README.md`.

## Verification

- `npm run build:admin` and `npm run build:ui` passed with the existing Anime.js, daisyUI, Tailwind, and esbuild dependencies; no additional package was required.
- Full regression suite: 332/332 tests passed, zero failures. `tests.txt` records the output. The LookBook test's sitemap ordering side effect was restored only after verifying identical complete URL entry sets against the pre-test bytes.
- Real admin route, auth, parser, validation, atomic catalog write, and public API tested with isolated in-memory Blob and PostgreSQL. Name-only changes preserved all commercial fields; search exports included matches beyond page one. Production catalog writes: zero.
- Chrome 157.0.8103.51: admin 1440/390px search, export, upload, preview, apply, empty state/reset, button sizing, no horizontal page overflow, and no page errors. Storefront 320/390/430px and 844x390 landscape plus 1440px desktop: photo order, color selection, all menu links reachable, short-screen scrolling, Escape/focus return, close/reopen, and desktop columns passed. Mobile-to-desktop resize closes the menu and unlocks page scrolling. These are emulated viewports/touch, not physical-device tests.
- `name-plan-validation.json`: all 114 proposed changes equal exact source titles; name is the only changed field; all listed commercial fields are preserved; all six aggregate color labels remain; selected Product JSON-LD name and price agree with the proposed page data.
- Figma existing home file `4ZaTeP48oaRmsYARMJwPyx` metadata inspected in a task session. It contains historical home concepts, not the current mobile layout or admin; the current source and the user's screenshots/requests govern these narrow changes.
- Impeccable mechanical detector ran once. Existing admin/global design tokens differ from the public DESIGN.md; existing style warnings are outside this change. The table wrapper warning is a false positive: its cells have padding and the narrow viewport intentionally scrolls the table horizontally. New search controls match the existing admin visual system and passed rendered checks.
- Browser evidence and limitations: `browser-verification.json`, `home-390.png`, `menu-390.png`, `home-1440.png`, `admin-name-preview-1440.png`, and `admin-name-preview-390.png` in the task backup directory. Task-owned Chrome contexts were closed.

## Production approval and release

The user explicitly approved committing/pushing the task files, production deployment, and applying the reviewed 114 name-only updates while leaving the three unmatched titles unchanged (“응 진행해~”). Production admin API preflight authenticated through the existing local configuration without exposing credentials and verified all 148 current names and models against the approved mapping. No catalog write occurred during preflight. The release uses a fresh API preview and an ETag-protected name-only PUT, preserving registered stock rather than public availability after reservations. Task-owned before/after product backups and the API receipt are stored under `backups/product-names-mobile-2026-11-12/`. Customer/member/order records are outside scope and were not accessed.

Release is in progress; do not infer completion from this log alone. The authoritative completion evidence will be `backups/product-names-mobile-2026-11-12/deployment-receipt.json` with the exact Git commit's production READY, live mobile/admin checks, name-application receipt, Product JSON-LD comparison, and unchanged price/stock/media checks. Existing daily story/LookBook states are unchanged.

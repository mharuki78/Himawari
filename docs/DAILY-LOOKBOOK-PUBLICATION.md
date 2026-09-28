# LookBook daily publication

## Scope and schedule

User authorized on 2026-09-28: add a LookBook menu and publish 2–3 newly generated photos each day showing real Himawari products worn by diverse people in varied places. Website publication and deployment are authorized; do not ask for confirmation each day. Use the current thread's model. This is separate from daily story publishing and Tuesday reviews; do not change those schedules.

Daily 09:00 Asia/Seoul: main publication. 09:30: recover missing stages only. Default 2 photos, optionally 3 for a cohesive varied set; never exceed 3 for a Korean date. Initial launch 2026-09-28 has 3. Determine the date from the heartbeat timestamp converted with Intl.DateTimeFormat and timeZone Asia/Seoul, never by manually adding a calendar day. Reject future dates.

## Resume first

Read this document at start and after compaction. Inspect Git status, local instructions, `lookbook/entries.json`, `docs/lookbook-runs/YYYY-MM-DD.json` and `backups/lookbook-YYYY-MM-DD/`. Fetch remote safely, preserve unrelated and uncommitted user work. If today's expected 2–3 photos already pass `node scripts/verify-daily-lookbook.mjs YYYY-MM-DD --published`, stop without images, uploads or repeat notification. Never regenerate an already approved image. Record expectedCount before generation. Keep progress, prompts, originals, generated sources and browser evidence in the date's ignored backup directory so 09:30 resumes only missing stages. Backups must not contain credentials.

## Photography

Review at least the last 14 published days and current story images. Rotate actual products, verified colors, adult ages, genders, appearances, outfits, seasons, locations, activities and camera compositions. Avoid the same person/backdrop/composition every day. Include full body, walking, seated, rear and side views when the bag is legible and the product's carry method supports it. Use varied city, everyday and travel categories. No invented product, unverified performance claim, customer testimonial or fake customer photograph.

Read the imagegen skill. Obtain live product catalog and actual catalog/original product photos; view each source directly, verify model, color and published width/height/depth. Record exact source URL and catalog reference. Use built-in imagegen with local referenced_image_paths. Preserve logo, shape, pockets, colors, straps, charms and human-relative scale. Fictional adult models only. Generate one new 2:3 portrait per entry (1024×1536); 2–3 new photos total per day, independent of story images. Save originals and generated files under the backup directory. View generated output and reject material product distortion or incorrect anatomy before approval. Set fidelityReviewed only after this review. If imagegen or originals are unavailable, report incomplete instead of substituting old stock images or a different brand.

Optimize each approved photo to WebP full 1024×1536 and thumbnail 640×960, retaining detail; target full <300KB, thumbnail <120KB. Use descriptive Korean alt text including AI 착용 연출. The page visibly labels AI staged imagery; do not describe it as actual customer wear or measured sizing.

## Data and static page

Append entries to `lookbook/entries.json`: unique date-category-model ID; Korean date; category city/travel/everyday; concise scene title; actual model/color/productId; scene description; alt; /assets/lookbook/...webp image and thumbnail paths; width1024,height1536. Different product models for each photo that day. No prices or availability claims in LookBook.

Write `docs/lookbook-runs/YYYY-MM-DD.json` following the first launch manifest: date, expectedCount, prepared stage, completionReceipt path, entries with id/model/productId/image, reference and generatedSource local backup paths, imageKind generated, dimensionsCm, exact dimensionsSource, sourceUrl, prompt, fidelityReviewed. Final deployment status is held in the receipt, never fabricated in advance. Save draft/progress backups at each stage.

Run `node scripts/build-lookbook.mjs` to generate accessible static HTML and update only the LookBook sitemap entry. The builder reuses the story index header/footer shell, shared navigation is in script.js. Photos remain available without JavaScript; filters, load more and native image viewer progressively enhance them. Do not edit past story pages, homepage stories, RSS feed or commerce settings for LookBook publication.

## Verify and publish

Run `node --test test/lookbook.test.mjs` and `node scripts/verify-daily-lookbook.mjs YYYY-MM-DD` successfully. Review changes; stage only authorized LookBook files and needed sitemap/navigation changes, never unrelated user files. Confirm product IDs against the live catalog. Browser check desktop and mobile: all new photos load, no horizontal overflow, visible AI disclosure, menu, filters, full-size viewer, previous/next, Escape/focus restoration and actual product links. The first launch also verifies tablet header and no-JavaScript access. For a later content-only run limit tests to relevant checks.

Commit and push to mharuki78/Himawari. Confirm the matching commit's Vercel production deployment is READY and aliased to himawari.co.kr, then verify the public LookBook and new product links in a browser. Save actual evidence in `backups/lookbook-YYYY-MM-DD/deployment.json`: date, commit, state READY, target production, deploymentUrl, url https://himawari.co.kr/lookbook/, entryIds, desktopVerified, mobileVerified, viewerVerified, productLinksVerified, verifiedAt, evidence paths. Never fill successful flags from assumptions.

Completion requires `node scripts/verify-daily-lookbook.mjs YYYY-MM-DD --published` to pass; it checks receipt/commit, live HTML and exact image bytes. On new completion send only the LookBook link and new image count. For authentication/service failure report remaining count, cause and required action. No messages to email, Naver Blog or other channels. Do not change prices, inventory, orders, login or payment settings.

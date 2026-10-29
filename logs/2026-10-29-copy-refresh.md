# Natural Korean copy refresh and story publication check

- User-facing date/timezone: 2026-10-29, Asia/Seoul.
- Author: Codex; task ID: copy-refresh-2026-10-29.
- Workspace/base: C:/Himawari, main 1dec9c96281471ba7989609578f17da68df6fdc5; main equals origin/main.
- User request: use I'm not AI to rewrite awkward representative page copy, beyond seven attached examples; check story publication since October 22.
- Additional explicit user approval: resume story automation daily 08:00 and 08:30 missing-stage check in Asia/Seoul.

## Scope and evidence

Rewrite marketing headlines, introductions and representative supporting text across public pages. Preserve product data, approved photos, official brand identity, policy values, factual founder history/quotations, existing article bodies/dates/URLs and all working UI. Current PRODUCT.md and DESIGN.md supply brand/audience context; no separate marketing context exists. Do not generate new past stories as part of this copy refresh.

Story check is saved at backups/copy-refresh-2026-10-29/story-check.json: live/local posts.json and RSS match, 167 stories, latest three dated October 22, completed with actual 08:13:19.597 KST publication evidence. There are no later story manifests/backups. Himawari automation configuration is absent, consistent with deletion of himawari-3 during earlier repeated-message removal. Exact deletion time is unverified. User approved a story-only replacement automation; LookBook/reviews are outside the new schedule.

Copy inventory, draft, humanize-korean role output/gates, browser evidence and deployment verification will be kept under backups/copy-refresh-2026-10-29/. Existing unrelated untracked files remain outside this task's commits.

## Checkpoint: copy and pre-release verification complete

Rewrote representative marketing copy across home, brand, catalog/category, product, finder, story list, LookBook, care, contact, comparison, guidebook and game pages. Abstract movement/balance/dignity slogans now describe choosing, viewing, using or asking about bags. Game copy explains the actual two stages and makes coupon availability conditional; the live promotions response has no active coupons. Static reel captions and API defaults match (live reels persisted=false). LookBook source and builder both contain the new introduction.

The marketing draft was followed by I'm not AI's humanize-korean light workflow and korean-humanizer. Independent editorial review corrected five phrases, including the finder zero-result heading and unsupported safety/comfort wording in the brand story. Original drafts and the first editorial output remain preserved; final.md and final-review-gates.txt hold the reviewed output and successful gates. Product data, policy values, approved images, founder quotation and all existing article bodies/dates/URLs remain unchanged. Hashes of posts.json, feed.xml, LookBook entries and products.json match the baseline.

Chrome checked 14 routes at 390 and 1440 widths: HTTP 200, no page runtime errors, no horizontal overflow. The only clipped-heading metric was the intentional sr-only catalog heading. Direct screenshot inspection covered home, brand and category mobile/desktop layouts. An actual empty finder result shows the neutral heading and recovery actions. Browser evidence is local-browser-batch.json and local-collections.json in the backup directory.

Browser verification exposed copy-literal coupling in collection server rendering: replacing the catalog heading stopped category headlines from appearing. The renderer now targets the stable catalog-title element, renders escaped category lines/description and falls back to the title when lines are absent. Product closing heading and fallback card copy also match client rendering. Collection regression failed before the fix and passed after; the full npm test suite passed 270/270. git diff --check and JavaScript syntax checks passed.

## User-approved automation restoration

Created the story-only heartbeat "Himawari 이야기 매일 발행", id himawari, ACTIVE, targeting this chat 01a08495-edb2-74e2-b203-1f9e52e791cd. The saved automation.toml was read back and confirmed daily 08:00 and 08:30; Windows timezone is Korea Standard Time (Asia/Seoul equivalent). The first future scheduled round is October 30; actual future execution is unverified. No historical stories were backfilled and no LookBook/review schedule was restored.

The full prompt is preserved as story-automation-prompt.txt. It requires three distinct bag-centered stories, six new generated images, provider-backed actual first/modification deployment times and complete deployment histories, published verification, duplicate prevention and quiet no-op behavior using the app's supplied runtime format. It contains no invented heartbeat response tags. New content completion or a failure/user action is the notification trigger.

Next: push only the task's source/test/log/STATE files, confirm the exact commit's Vercel production READY and recheck the live site. Final release evidence and status will be maintained in backups/copy-refresh-2026-10-29/receipt.json.

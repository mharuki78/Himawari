# Npay production cutover checklist

This is a release procedure, not an activation receipt. Current execution evidence is in `logs/2026-11-16-npay-release-preparation.md`. The earlier implementation and successful sandbox payment/cancellation evidence remain in `logs/2026-11-15-npay-sandbox-resume.md`.

## Provider and account gates

1. Preserve the single [inspection request #227](https://github.com/npay-mall-order-api/merchant-order-api/discussions/227). The official [approval reply](https://github.com/npay-mall-order-api/merchant-order-api/discussions/227#discussioncomment-19644541), posted2026-11-16T02:41:08Z, confirms completed Sandbox inspection. Live Chrome inspection verified the reply; a search-cached zero-comment page was stale. Preserve this actual evidence before setting `provider_approved_at` during an authorized release. It does not establish that production credentials have been issued.
2. After approval, use the official production-issuance process: a private email to `dl_techsupport@navercorp.com` containing the merchant-center ID, developer email and API calling IPs. Prepare a reviewable message and obtain the owner's separate sending/data-sharing approval before transmission. Keep those values and all credentials out of public GitHub, Git, logs and screenshots. Existing account-settings inspection approval persists.
3. Obtain production application credentials through the approved private/provider flow. Existing sandbox credential envelopes are preview-only and must not be copied into production as production credentials.
4. Follow the official [registered-domain reply](https://github.com/npay-mall-order-api/merchant-order-api/discussions/222#discussioncomment-19643883), posted2026-11-16T01:46:02Z: the registered test domain is `https://allaboutbag.com/` and production is `https://himawari.co.kr/`. One domain is allowed per environment; no additional review domain or exception is available. Use the registered test domain with access restricted to test accounts, after preparing and reviewing its routing; do not expose a general-user test checkout or silently repoint an existing production alias. PC direct checkout success and a responsive cancellation page do not verify the complete genuine mobile button/payment flow.

Official process: [Npay merchant API guide](https://github.com/npay-mall-order-api/merchant-order-api#주문관리-api-연동-프로세스).

## Polling capacity decision — owner chose free, six collections daily

The owner chose2026-11-16 to retain Fixie Tricycle (US$0,500/month,100MB) and collect six times daily. No paid upgrade is authorized. Configure `NPAY_SYNC_CADENCE=4h` with the native Vercel Schedules expression `0 */4 * * *`, timezone Asia/Seoul; the schedule uses GET `/api/npay/sync`. Set Production `CRON_SECRET` and `NPAY_SYNC_SECRET` to the same random secret, and confirm the actual deployed schedule/execution history before recording capacity proof. Native Schedules supports a four-hour interval on Hobby, with up to15minutes jitter; this differs from legacy Cron Jobs' daily Hobby limit. No SDK or hosting upgrade is needed for a path target. Sources: [configuration](https://vercel.com/docs/schedules/configuration), [path authentication](https://vercel.com/docs/schedules/handle-runs), [limits](https://vercel.com/docs/schedules/limits).

Four-hour policy caps each invocation at10upstream requests and requires both complete collection time and successful sync time within5hours, zero incidents, and matching `sync_cadence=4h` release proof. The five-minute policy keeps its original10-minute freshness limit; invalid/mismatched policy closes managed checkout. Reservations are allocated before upstream registration and never released on timeout/absence. Completed cancellations update on the next successful collection plus any provider propagation delay; no finite provider propagation guarantee is asserted.

The approved initial48-hour audit completed with zero changed order lines and at most3HTTP calls (one OAuth plus two change queries). Fixie dashboard immediately before/after showed16→17requests and194→204kB. Current transport reuses one HTTPS CONNECT connection within a poll. This one measured invocation supports connection reuse; it does not prove that every invocation will always consume one metered request. Thirty-one days at six runs daily is186runs. The earlier372–558estimate counts upstream HTTP calls, not necessarily Fixie metered proxy connections. Watch actual request and transfer counters, keep manual/preview calls in the same budget, preserve holds on quota/connection failures, and obtain approval before any paid change. Do not promise uninterrupted free capacity or an unconfigured alert/automatic upgrade.

The present client reuses an OAuth token within one invocation, then clears it when closing. It does not guarantee token reuse across serverless invocations. Budget authentication as well as changed-order pages and detail batches. `maxRequests=20` is a per-invocation guard; it is not a normal request forecast.

Public [Fixie HTTP/HTTPS pricing](https://usefixie.com/pricing), checked2026-11-16:

| Plan | Requests/month | Transfer/month | Recurring price |
| --- | ---: | ---: | ---: |
| Tricycle | 500 | 100MB | US$0/month |
| Commuter | 2,500 | 500MB | US$5/month |
| Cruiser | 25,000 | 10GB | US$19/month |
| Hybrid | 250,000 | 50GB | US$49/month |

Illustration only, not a configured schedule: `*/7 * * * *` runs nine times per hour, or6,696 times in31days. Two calls per empty poll require13,392 requests; three calls per normal poll require20,088. Adding20% yields24,106, close to Cruiser's25,000 limit. At the current20-request invocation ceiling, the same schedule could consume133,920. Multiple pages/batches, catch-up, registrations using that proxy and other traffic must be counted separately as applicable. Do not mark capacity verified from the normal-path estimate alone. Free500/month is insufficient for this continuous polling pattern.

The five-minute policy requires both `last_success_at` and `through_at` to be no more than600seconds old. The explicit four-hour policy above uses5hours only with matching release proof. A scheduler must allow collection duration, overlap, failure/recovery and quota headroom inside its verified policy. Actual schedule activation and a successful authenticated deployed run remain release evidence; configuration alone is not that proof. Paid recurring service requires the owner's specific plan/amount approval.

## Legacy checkout and inventory gates

- Reconcile the old unreserved ordinary Npay path before enabling reservation-bound campaign/mixed orders. Obtain explicit production order/customer-data approval for the exact read scope, fields, processing destinations and retained metadata first. Sandbox approval does not authorize this production access.
- Preserve uncertain/expired holds. Npay has not supplied a guaranteed propagation bound or collection-finality barrier; elapsed time or a completed polling window is insufficient evidence to release them automatically.
- Bind any supported new ordinary/campaign/mixed registration to the shared inventory/quota allocator, immutable price/option and one upstream registration result. Old unreserved identities must stop being purchasable as designed during controlled cutover.
- Do not set `cutover_verified_at` until actual legacy behavior and inventory reconciliation are evidenced. Record a rollback plan that closes new registration while preserving holds and authenticated reconciliation; never free reservations as a rollback shortcut.
- Keep `NPAY_MANAGED_CHECKOUT_REQUIRED=true` after retirement so missing database/configuration cannot reopen fallback. Before marking cutover, verify the old SKU callback and the existing ordinary canary order form against the retired identity. The approved48-hour audit and absence of local Npay holds are point-in-time evidence, not a provider finality barrier.
- After a stored production cutover, any observed provider line without a matching managed reservation (including legacy products and orphan NPR aliases) latches `npay_sync_state.legacy_order_incident`. Unknown batches stop before managed settlement writes. Later empty/failed polls do not clear this latch or restore readiness; retain the cutover date and reservations until approved operator inventory review resolves it. A latch prevents silent healthy status but is not a synthetic inventory adjustment for an old unreserved purchase.

## Release and completion gates

- Keep public campaign capability closed while any provider, capacity, cutover or current-sync proof is absent. Do not bypass the capability guard with an enable-only environment flag.
- Integrate the tested Npay changes with current main so existing product buttons, selected SKU, cart/order prices, thumbnails, 70,000KRW free-shipping threshold and published stories remain intact.
- Deploy the verified source to the existing private sandbox branch first; preserve branch-scoped sandbox secrets and test DB separation. Check the exact commit's READY state and protected review mode without leaking its access token.
- After the external gates and approvals are satisfied, apply production settings, test the genuine registered-origin desktop/mobile flow, and confirm server capability, discounted/mixed totals and fresh successful reconciliation. A new production payment still needs an explicit amount/payee approval or owner-led authentication when required.
- Record actual evidence for all four release-proof dates and the final deployment; a date typed into a table is not evidence. Report actual production availability only after this final verification.

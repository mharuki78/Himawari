# Npay production cutover checklist

This is a release procedure, not an activation receipt. Current execution evidence is in `logs/2026-11-16-npay-release-preparation.md`. The earlier implementation and successful sandbox payment/cancellation evidence remain in `logs/2026-11-15-npay-sandbox-resume.md`.

## Provider and account gates

1. Preserve the single [inspection request #227](https://github.com/npay-mall-order-api/merchant-order-api/discussions/227). A submission or an unanswered question does not establish approval. Record the actual approval link and time before setting `provider_approved_at`.
2. After approval, use the official production-issuance process: a private email to `dl_techsupport@navercorp.com` containing the merchant-center ID, developer email and API calling IPs. Prepare a reviewable message and obtain the owner's separate sending/data-sharing approval before transmission. Keep those values and all credentials out of public GitHub, Git, logs and screenshots. Existing account-settings inspection approval persists.
3. Obtain production application credentials through the approved private/provider flow. Existing sandbox credential envelopes are preview-only and must not be copied into production as production credentials.
4. Resolve the registered-origin PC/mobile test procedure from [the existing domain question](https://github.com/npay-mall-order-api/merchant-order-api/discussions/222#discussioncomment-19628381). PC direct checkout success and a responsive cancellation page do not verify the complete genuine mobile button/payment flow.

Official process: [Npay merchant API guide](https://github.com/npay-mall-order-api/merchant-order-api#주문관리-api-연동-프로세스).

## Polling capacity decision

The present client reuses an OAuth token within one invocation, then clears it when closing. It does not guarantee token reuse across serverless invocations. Budget authentication as well as changed-order pages and detail batches. `maxRequests=20` is a per-invocation guard; it is not a normal request forecast.

Public [Fixie HTTP/HTTPS pricing](https://usefixie.com/pricing), checked2026-11-16:

| Plan | Requests/month | Transfer/month | Recurring price |
| --- | ---: | ---: | ---: |
| Tricycle | 500 | 100MB | US$0/month |
| Commuter | 2,500 | 500MB | US$5/month |
| Cruiser | 25,000 | 10GB | US$19/month |
| Hybrid | 250,000 | 50GB | US$49/month |

Illustration only, not a configured schedule: `*/7 * * * *` runs nine times per hour, or6,696 times in31days. Two calls per empty poll require13,392 requests; three calls per normal poll require20,088. Adding20% yields24,106, close to Cruiser's25,000 limit. At the current20-request invocation ceiling, the same schedule could consume133,920. Multiple pages/batches, catch-up, registrations using that proxy and other traffic must be counted separately as applicable. Do not mark capacity verified from the normal-path estimate alone. Free500/month is insufficient for this continuous polling pattern.

The readiness guard requires both `last_success_at` and `through_at` to be no more than600seconds old. A scheduler must allow collection duration, overlap, failure/recovery and quota headroom inside that condition. Verify the actual hosting plan's cron frequency and authentication mechanism before configuration; no cron is configured by this document. Paid recurring service requires the owner's specific plan/amount approval.

## Legacy checkout and inventory gates

- Reconcile the old unreserved ordinary Npay path before enabling reservation-bound campaign/mixed orders. Obtain explicit production order/customer-data approval for the exact read scope, fields, processing destinations and retained metadata first. Sandbox approval does not authorize this production access.
- Preserve uncertain/expired holds. Npay has not supplied a guaranteed propagation bound or collection-finality barrier; elapsed time or a completed polling window is insufficient evidence to release them automatically.
- Bind any supported new ordinary/campaign/mixed registration to the shared inventory/quota allocator, immutable price/option and one upstream registration result. Old unreserved identities must stop being purchasable as designed during controlled cutover.
- Do not set `cutover_verified_at` until actual legacy behavior and inventory reconciliation are evidenced. Record a rollback plan that closes new registration while preserving holds and authenticated reconciliation; never free reservations as a rollback shortcut.

## Release and completion gates

- Keep public campaign capability closed while any provider, capacity, cutover or current-sync proof is absent. Do not bypass the capability guard with an enable-only environment flag.
- Integrate the tested Npay changes with current main so existing product buttons, selected SKU, cart/order prices, thumbnails, 70,000KRW free-shipping threshold and published stories remain intact.
- Deploy the verified source to the existing private sandbox branch first; preserve branch-scoped sandbox secrets and test DB separation. Check the exact commit's READY state and protected review mode without leaking its access token.
- After the external gates and approvals are satisfied, apply production settings, test the genuine registered-origin desktop/mobile flow, and confirm server capability, discounted/mixed totals and fresh successful reconciliation. A new production payment still needs an explicit amount/payee approval or owner-led authentication when required.
- Record actual evidence for all four release-proof dates and the final deployment; a date typed into a table is not evidence. Report actual production availability only after this final verification.

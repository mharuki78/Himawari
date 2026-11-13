# Campaign Npay: activation prerequisites

Status on 2026-11-13: **campaign purchases not enabled; sandbox onboarding and authentication verified**. The free Fixie Tricycle proxy and its two fixed outbound IPs were verified. The approved Npay API application was submitted successfully; the issued sandbox application is active and its two registered IPs match the proxy. Authenticated API documentation version1.11.0 is accessible. A single bounded sandbox token request through the TLS proxy returned HTTP200 and a Bearer token; the token was not returned to chat or written to files. Production issuance still requires sandbox development and provider inspection. The ordinary Npay purchase path remains enabled. Campaign registration is rejected server-side with `503 / NPAY_CAMPAIGN_INTEGRATION_REQUIRED`; it must never fall through to the ordinary price. `/api/npay/config` reports `blackFriday.enabled=false` and `reason=order_management_required`.

The purchase button's merchant/certificate keys configure registration. They do not configure order-management synchronization. Do not add an environment flag to open campaign purchases before implementing and testing the missing contract.

## Verified provider requirements

The [official Naver support repository](https://github.com/npay-mall-order-api/merchant-order-api#주문관리-api-연동-프로세스) describes separate sandbox application issuance from the merchant center's API-management menu, authenticated API documentation, sandbox inspection, and production application issuance. The [official FAQ](https://developers.pay.naver.com/support/faq/order) requires registered calling IPs and periodic order queries. Confirm a supported outbound IP arrangement before selecting deployment infrastructure; Vercel deployment alone does not establish that prerequisite.

The public [v2.1 protocol](https://github.com/user-attachments/files/26292822/Naver_Pay-Shop_Interworking_Guide_2.1-ko_260204.pdf) supports selling price and stock XML. Product-info GET requests are not authenticated payment events and may also be used outside checkout. They document no merchant reservation identifier, payment commit, registration cancellation or registration-key expiry. Do not decrement stock on GET or invent a hold timeout.

Optional [webhooks](https://github.com/npay-mall-order-api/merchant-order-api/wiki/%EC%9B%B9%ED%9B%85-(Web-hook)) require separate onboarding and an authenticated contract. Duplicates, delay and missing deliveries must be handled. Polling/webhooks reconcile order state but do not themselves prove an atomic cross-channel quota guarantee.

## Merchant onboarding inspected on 2026-11-13

Before submission, the authenticated merchant's API-management entry displayed the application-entry screen with no application ID or secret. The application popup requires a developer email and calling-server IPs: at most three individual IP addresses, separated by commas or newlines; its note explicitly excludes subnet masks/ranges. The owner entered the developer email directly; only presence and format booleans were inspected. The email value was not copied to this record.

The current twelve-page API terms were read from the official in-page PDF (effective 2026-03-04). The separate privacy notice collects an email address for API authentication-change/incident notices and retains it for the API use period. After the owner's explicit submission approval and fixed-IP verification, the final application and email confirmation were accepted. Naver displayed its success alert, closed the popup and showed an active sandbox application. Customer/order records and real payments remain outside the approved scope.

Official merchant pages (authentication required):

- [API management entry](https://admin.pay.naver.com/front/o/v1/order_pay/page/sale/api-management/entry)
- [API terms](https://admin.pay.naver.com/front/o/v1/order_pay/page/sale/api-management/popup/terms)
- [Privacy notice](https://admin.pay.naver.com/front/o/v1/order_pay/page/sale/api-management/popup/privacy)

## Calling-IP decision and approval

Default Vercel function egress is dynamic. A site's DNS/inbound address or the owner's PC IP must not be entered as the server's fixed egress. The read-only Vercel project connector does not expose networking settings, so its result is not evidence that Static IPs are enabled or disabled.

The owner approved free Fixie signup/setup (name and work email provided to Fixie), no paid upgrade, and separately approved submitting the Npay API terms/privacy application with real calling IPs. Initial approval excluded payment-method registration. When free provisioning reached Stripe checkout (KRW0/month), work paused; the owner then chose to enter the card and complete the free subscription directly. No card values were read, entered or stored by Codex, and Codex did not click subscription confirmation. The subsequently created HTTP/HTTPS, US East, Tricycle app `Himawari Npay sandbox` was verified with500 requests/100 MB per month and two outbound IPs. Those IPs were transferred directly between the approved browser pages without exposing their values to logs, chat or Git; the registered Npay IPs were compared and match. Keep these approvals on resume; do not ask for them again within the same scope.

The [current Fixie pricing](https://usefixie.com/pricing) lists HTTP/S free service at500 requests/100 MB per month, US$0; that free account allowance is now verified. Paid service starts at US$5 for2,500 requests and US$19 for25,000 requests. No paid plan was purchased by Codex. The free allowance is for bounded sandbox work; it is not enough for continuous frequent production polling. Production capacity and paid recurring fees need a separate decision/approval.

[Fixie's official HTTPS documentation](https://usefixie.com/documentation/http-and-https-requests) describes two fixed egress addresses per proxy group and CONNECT tunneling with end-to-end HTTPS. If selected, also use TLS to the proxy (`https`, port 443), keep certificate validation enabled and route only the intended Npay API hosts. Do not print proxy authentication or Npay secrets. Stop before any paid enrollment, trial requiring payment details, or automatic-charge condition.

Npay application issuance alone does not authorize reading existing orders or making actual payments and does not establish a safe campaign stock contract.

The owner subsequently approved publishing the prepared technical questions to the public Npay Q&A, including public author-account visibility. [Discussion222](https://github.com/npay-mall-order-api/merchant-order-api/discussions/222) was submitted once and independently verified without login on2026-11-13. It asks about BUY_KEY reuse/expiry, atomic stock handling, stopping stale campaign checkout and releasing abandoned allocations. No merchant IDs, keys, IPs, contact details or customer/order data were included. The [published draft record](npay-stock-contract-question-draft.md) and `backups/npay-campaign-2026-11-13/support-discussion-receipt.json` preserve that action. This is a contract-confirmation question, not a provider inspection request or production activation.

The official responder requested a merchant URL or business number for identification before answering the technical questions. The owner separately approved a public reply containing only the already-public store URL. [That reply](https://github.com/npay-mall-order-api/merchant-order-api/discussions/222#discussioncomment-19579606) was posted once and anonymously verified as HTTP200 with matching text. As of the02:07 UTC check on2026-11-13, no technical stock/reuse/expiry answer was visible. Do not treat the identification request as a reservation contract or inspection approval, and do not post the same reply again.

## Authorized documentation reached

The [sandbox documentation](https://sandbox-api.pay.naver.com/npay/partner) was opened with the issued sandbox ID/secret transferred directly to the official Naver form, without chat/log/file/screenshot disclosure. Its form has a one-minute submission window; reloading was needed after expiry. Version1.11.0 documents OAuth2 client-credentials, bcrypt/client-secret signing, a three-hour token lifetime, and periodic changed-order/detail queries. No actual token request, existing-order query or payment was made during documentation access. Read the authorized schemas before implementation; authenticated documentation access is not production readiness.

## Bounded sandbox authentication check

The follow-up authenticated one sandbox request at `/npay/partner/v1/oauth2/token`, type `SELF`, using the documented bcrypt/signature fields. A fresh one-shot local process used pinned bcryptjs3.0.3 and undici8.12.4, validated the official synthetic signing vector first, then made a single non-idempotent POST with no redirect/retry interceptor. Proxy and endpoint TLS certificate verification remained enabled; the proxy connection used HTTPS port443 and CONNECT. Response:HTTP200, Bearer token present, expires_in10799 seconds. No order API was called.

Approved browser-held keys and the proxy URL were encrypted with an ephemeral RSA-OAEP/SHA256 public key for local transfer; the private key existed only in the one-shot process memory. Plaintext credentials, signing payloads and access tokens were not printed, passed as command arguments, written to files or committed. The process ended and temporary encrypted transfer state was cleared. The probe and its isolated dependencies live only under `backups/npay-campaign-2026-11-13/auth-probe/`; production dependencies and commerce source were unchanged. Current evidence: `backups/npay-campaign-2026-11-13/followup-and-auth-verification.json`.

## Required next work

### Technical response received, 2026-11-13

The [official response](https://github.com/npay-mall-order-api/merchant-order-api/discussions/222#discussioncomment-19581076), posted at 03:13 UTC and verified in Chrome, resolves the initial questions:

- A BUY_KEY belongs to one registration/buyer. Multiple windows can open it, but one completed payment prevents another. It expires at 23:59:59 the following day; merchant revocation is unavailable.
- Npay neither reserves nor decrements stock. Payment checks a snapshot; concurrent overselling is possible. No final reservation callback/API is provided. Managed options use combination stock/status.
- Payment-time NOT_SALE blocks purchase; SOLD_OUT covers stock exhaustion. Changed prices also block purchase.
- Abandonment produces no status/expiry notification. After expiry, the provider allows releasing stock if no pending/paid order was collected. Collection completeness/latency still needs clarification; do not infer an automatic release timer from this alone.

On the owner's explicit instruction, supplied business-identification details were added to [one follow-up](https://github.com/npay-mall-order-api/merchant-order-api/discussions/222#discussioncomment-19581222). It asks whether reservation-specific product IDs/option manageCodes are permitted and how to prove final order collection before release. Anonymous Chrome HTTP 200 and matching text were verified. Receipt: `backups/npay-campaign-2026-11-13/business-followup-receipt.json`. Campaign purchases remain closed; no production commerce change was made.

### Follow-up answered and staged implementation

The [follow-up response](https://github.com/npay-mall-order-api/merchant-order-api/discussions/222#discussioncomment-19582387), posted at 04:44:56 UTC on 2026-11-13, explicitly permits reservation-specific product IDs/option manageCodes. It provides no recommended alternative, final collection criterion, or guaranteed maximum propagation delay. Anonymous Chrome HTTP 200 and the official account link were verified; response hash: `58cbf39b5c3af60b202c80911b785a04b86f333008f3f42b4f85e89df9982e5b`.

The local feature branch `codex/npay-campaign-reservations-20261113` now contains a durable internal allocator, shared physical/quota accounting, one-time registration claims, immutable sale-price/selected-option projections, physical detail links, and `NOT_SALE` responses for blocked or revised identities. Uncertain/expired holds have no automatic release path. The order-feed reader uses the authenticated 1.11.0 schema, fixed inclusive windows and provider cursors, 300-ID detail batches and a metadata whitelist; missing rows and count discrepancies never establish collection finality or release stock. Count discrepancies withhold cursor advancement. Catalog/campaign revision changes conservatively block old projections, even when only an unrelated setting changed.

This is pre-activation backend work, not completed checkout integration. No public registration path invokes the allocator yet. Still required: authenticated registration/result persistence and paid/cancelled/returned quantity reconciliation; converting ordinary Npay registrations to reservations; a safe legacy-checkout/wishlist transition; sandbox flow/inspection and production issuance. An already-open ordinary Npay stock snapshot can otherwise race a new campaign hold. Keep the existing public campaign rejection/configuration until those gates are verified.

Only synthetic isolated PostgreSQL/order fixtures were used. No actual customer/order query, new token request, payment, production data migration or deployment was performed. A live sandbox order API response can include names/contact/address, so the prior settings-inspection approval does not cover it; obtain explicit scoped approval before accessing that response. Evidence and current verification: `backups/npay-campaign-2026-11-13/reservation-development-receipt.json`.

1. With the owner's scoped approval, inspect API issuance/settings only. Customer records, existing orders and actual payment operations are outside that approval. Keep credentials in a secure local/provider flow; do not paste them into chat, logs, Git or screenshots.
2. Apply the confirmed one-payment BUY_KEY, payment-time state/price and next-day expiry rules. Reservation-specific product/option identities are now approved; there is no provider final collection barrier. Keep unresolved stock reserved and handle verified terminal quantities idempotently. Npay snapshot stock checks alone cannot enforce a shared limited quota.
3. Bind the campaign identity to campaign, offer, physical product/option and selling price. Refresh price and quota from the server. Never fall back to ordinary-price XML for a stale campaign identity.
4. In the existing common inventory lock, atomically allocate the physical stock and campaign quota across regular checkout and Npay. Reconcile paid, cancelled and refunded states idempotently using authenticated provider evidence; do not release a potentially payable allocation on an assumed timeout.
5. Preserve regular and mixed-cart prices, options, shipping threshold, and selected-line checkout. A campaign option must expose its combination stock because root stock is ignored for option-managed products. Ended/removed identities must stop being purchasable.
6. Verify in sandbox: exact sale-price XML, mixed cart totals, last-unit contention, retries, abandoned checkout, price/option changes, campaign end, paid/cancelled reconciliation, duplicate/out-of-order events, and polling recovery. Obtain separate approval for any actual payment or personal-data use.
7. Complete provider inspection/onboarding; then enable frontend support based on actual backend capability and verify the deployed desktop/mobile flow. Credential presence alone is insufficient readiness evidence.

Do not contact technical support or send merchant information without explicit sending authorization. This document is an implementation prerequisite record, not a claim that campaign Npay purchases work.

# Campaign Npay: activation prerequisites

Status on 2026-11-13: **campaign purchases not enabled; sandbox onboarding completed**. The free Fixie Tricycle proxy and its two fixed outbound IPs were verified. The approved Npay API application was submitted successfully; the issued sandbox application is active and its two registered IPs match the proxy. Authenticated API documentation version1.11.0 is accessible. Production issuance still requires sandbox development and provider inspection. The ordinary Npay purchase path remains enabled. Campaign registration is rejected server-side with `503 / NPAY_CAMPAIGN_INTEGRATION_REQUIRED`; it must never fall through to the ordinary price. `/api/npay/config` reports `blackFriday.enabled=false` and `reason=order_management_required`.

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

## Authorized documentation reached

The [sandbox documentation](https://sandbox-api.pay.naver.com/npay/partner) was opened with the issued sandbox ID/secret transferred directly to the official Naver form, without chat/log/file/screenshot disclosure. Its form has a one-minute submission window; reloading was needed after expiry. Version1.11.0 documents OAuth2 client-credentials, bcrypt/client-secret signing, a three-hour token lifetime, and periodic changed-order/detail queries. No actual token request, existing-order query or payment was made during documentation access. Read the authorized schemas before implementation; authenticated documentation access is not production readiness.

## Required next work

1. With the owner's scoped approval, inspect API issuance/settings only. Customer records, existing orders and actual payment operations are outside that approval. Keep credentials in a secure local/provider flow; do not paste them into chat, logs, Git or screenshots.
2. Obtain the authorized API schemas and confirm how Naver binds, validates and settles a limited-stock allocation, including repeated order attempts and wishlist/history purchases. Record provider evidence before designing release/expiry behavior.
3. Bind the campaign identity to campaign, offer, physical product/option and selling price. Refresh price and quota from the server. Never fall back to ordinary-price XML for a stale campaign identity.
4. In the existing common inventory lock, atomically allocate the physical stock and campaign quota across regular checkout and Npay. Reconcile paid, cancelled and refunded states idempotently using authenticated provider evidence; do not release a potentially payable allocation on an assumed timeout.
5. Preserve regular and mixed-cart prices, options, shipping threshold, and selected-line checkout. A campaign option must expose its combination stock because root stock is ignored for option-managed products. Ended/removed identities must stop being purchasable.
6. Verify in sandbox: exact sale-price XML, mixed cart totals, last-unit contention, retries, abandoned checkout, price/option changes, campaign end, paid/cancelled reconciliation, duplicate/out-of-order events, and polling recovery. Obtain separate approval for any actual payment or personal-data use.
7. Complete provider inspection/onboarding; then enable frontend support based on actual backend capability and verify the deployed desktop/mobile flow. Credential presence alone is insufficient readiness evidence.

Do not contact technical support or send merchant information without explicit sending authorization. This document is an implementation prerequisite record, not a claim that campaign Npay purchases work.

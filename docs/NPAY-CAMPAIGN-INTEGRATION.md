# Campaign Npay: activation prerequisites

Status on 2026-11-12: **not enabled**. The ordinary Npay purchase path is enabled. Campaign registration is rejected server-side with `503 / NPAY_CAMPAIGN_INTEGRATION_REQUIRED`; it must never fall through to the ordinary price. `/api/npay/config` reports `blackFriday.enabled=false` and `reason=order_management_required`.

The purchase button's merchant/certificate keys configure registration. They do not configure order-management synchronization. Do not add an environment flag to open campaign purchases before implementing and testing the missing contract.

## Verified provider requirements

The [official Naver support repository](https://github.com/npay-mall-order-api/merchant-order-api#주문관리-api-연동-프로세스) describes separate sandbox application issuance from the merchant center's API-management menu, authenticated API documentation, sandbox inspection, and production application issuance. The [official FAQ](https://developers.pay.naver.com/support/faq/order) requires registered calling IPs and periodic order queries. Confirm a supported outbound IP arrangement before selecting deployment infrastructure; Vercel deployment alone does not establish that prerequisite.

The public [v2.1 protocol](https://github.com/user-attachments/files/26292822/Naver_Pay-Shop_Interworking_Guide_2.1-ko_260204.pdf) supports selling price and stock XML. Product-info GET requests are not authenticated payment events and may also be used outside checkout. They document no merchant reservation identifier, payment commit, registration cancellation or registration-key expiry. Do not decrement stock on GET or invent a hold timeout.

Optional [webhooks](https://github.com/npay-mall-order-api/merchant-order-api/wiki/%EC%9B%B9%ED%9B%85-(Web-hook)) require separate onboarding and an authenticated contract. Duplicates, delay and missing deliveries must be handled. Polling/webhooks reconcile order state but do not themselves prove an atomic cross-channel quota guarantee.

## Required next work

1. With the owner's scoped approval, inspect API issuance/settings only. Customer records, existing orders and actual payment operations are outside that approval. Keep credentials in a secure local/provider flow; do not paste them into chat, logs, Git or screenshots.
2. Obtain the authorized API schemas and confirm how Naver binds, validates and settles a limited-stock allocation, including repeated order attempts and wishlist/history purchases. Record provider evidence before designing release/expiry behavior.
3. Bind the campaign identity to campaign, offer, physical product/option and selling price. Refresh price and quota from the server. Never fall back to ordinary-price XML for a stale campaign identity.
4. In the existing common inventory lock, atomically allocate the physical stock and campaign quota across regular checkout and Npay. Reconcile paid, cancelled and refunded states idempotently using authenticated provider evidence; do not release a potentially payable allocation on an assumed timeout.
5. Preserve regular and mixed-cart prices, options, shipping threshold, and selected-line checkout. A campaign option must expose its combination stock because root stock is ignored for option-managed products. Ended/removed identities must stop being purchasable.
6. Verify in sandbox: exact sale-price XML, mixed cart totals, last-unit contention, retries, abandoned checkout, price/option changes, campaign end, paid/cancelled reconciliation, duplicate/out-of-order events, and polling recovery. Obtain separate approval for any actual payment or personal-data use.
7. Complete provider inspection/onboarding; then enable frontend support based on actual backend capability and verify the deployed desktop/mobile flow. Credential presence alone is insufficient readiness evidence.

Do not contact technical support or send merchant information without explicit sending authorization. This document is an implementation prerequisite record, not a claim that campaign Npay purchases work.

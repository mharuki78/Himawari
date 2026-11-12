# Npay campaign integration work

- Date: 2026-11-12 Asia/Seoul; owner: Codex; task: npay-campaign-20261112.
- User confirmed: resolve campaign Npay purchase restriction; prior source synchronization/deployment authorization persists.
- Verified: browser prevents campaign checkout, but API drops campaign context and builds ordinary-price XML. There is no payment/cancellation synchronization in the source.
- Official protocol review: order registration and product-info XML are available. Order-management API needs separate application onboarding; product-info GET is a stock snapshot, not a reservation or payment event. No public evidence for automatic reservation expiry or an atomic payment commit.
- Implementation scope: prevent incorrect normal-price registration; prepare campaign-bound XML and regression tests. Keep campaign Npay closed until lifecycle/reservation guarantees are implemented and verified.
- Privacy/payment boundary: no real order, payment, account, customer data, credential or payment-setting access. Tests use synthetic fixtures and mocked HTTP only.
- Verified regression: synthetic campaign API request returned HTTP200 and attempted normal-price provider registration before the patch. After the patch it returns HTTP503 / NPAY_CAMPAIGN_INTEGRATION_REQUIRED with zero upstream requests. Includes mixed carts, top-level/null/malformed contexts. Ordinary order tests remain green.
- Verification: full suite397/397 and final focused18/18 passed. Sitemap URL contents were compared before restoring test-only ordering changes; original bytes preserved. Independent review found no substantive defect; suggested malformed/mixed-case assertions were added and passed. The reviewer additionally verified the review-session boundary without inherited environment or real network access.
- Ruling: defer campaign identity/XML preparation until the lifecycle/reservation contract is accessible. This changes the planned sequence, not the user's requested outcome; no campaign checkout activation is claimed. Pure preparatory projections would be unused and would not establish stock safety.
- Current status: server protection ready for deployment; campaign Npay remains incomplete. Narrow merchant settings access approval is pending.

## Official evidence and next concrete action

- [Naver technical support](https://github.com/npay-mall-order-api/merchant-order-api#주문관리-api-연동-프로세스): the merchant API-management screen issues a separate sandbox application; API documentation requires that application's ID/secret. Inspection precedes production application issuance.
- [Naver order FAQ](https://developers.pay.naver.com/support/faq/order): calling IPs must be registered. Orders are synchronized by periodic API queries, not automatically delivered by the registration button.
- [Full official v2.1 protocol](https://github.com/user-attachments/files/26292822/Naver_Pay-Shop_Interworking_Guide_2.1-ko_260204.pdf): product-information XML checks stock but carries no authenticated payment/reservation event. Option-managed products require combination stock, not just root stock.
- [Webhook contract overview](https://github.com/npay-mall-order-api/merchant-order-api/wiki/%EC%9B%B9%ED%9B%85-(Web-hook)): separate enrollment/HMAC and polling reconciliation; not an assumed replacement for atomic quota enforcement.
- Next after approval: inspect only merchant API issuance/settings and access the authorized protocol documentation through the secure local flow. Confirm sandbox app availability, calling-IP prerequisites and the supported way to bind and settle a campaign allocation. Do not create/purchase a real order or read existing customer/order records under that approval. Do not email technical support without separate explicit sending authorization.
- Detailed continuation: [activation prerequisites](../docs/NPAY-CAMPAIGN-INTEGRATION.md). Current provider/API configuration has not been inspected or changed.

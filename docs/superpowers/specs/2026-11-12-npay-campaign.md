# Campaign Npay integration boundary

User request: enable Black Friday purchases through Npay with the actual campaign price and quota.

Verified starting point: the browser blocks campaign lines, but the server silently ignores campaign metadata and registers the ordinary catalog price. The ordinary Npay integration is public and enabled. There is no order-management synchronization or authenticated payment/cancellation callback in this application.

This change must first reject campaign registration on the server rather than silently charging a different price. Prepare isolated campaign identities and product-information XML from validated public campaign data. Each identity binds campaign, offer, physical SKU, and price; stale identities must never resolve to an ordinary listing. Option availability must be restricted to that offer's option. Expired, removed, or repriced offers have no purchasable response.

Activation requires a verified Naver order lifecycle and reservation contract. The public v2.1 product-information GET has no order or reservation identity and is also used for wishlist/returns. Stock snapshots alone do not guarantee allocation across channels. Do not invent a callback, timeout, registration-key lifetime, or an environment-variable bypass. Keep the existing frontend restriction until the required contract is implemented and verified.

No real order/payment, production member/customer/order reads, credentials, merchant account, or payment setting changes are authorized by the current code task. Obtain scoped approval for any required account/PII-dependent onboarding after completing the supported implementation and tests.

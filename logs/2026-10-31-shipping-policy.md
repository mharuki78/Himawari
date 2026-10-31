# Confirmed shipping-time policy and structured data

Task shipping-policy-2026-10-31; author Codex; timezone Asia/Seoul. Base04975eea30f65ab8131d7c3196d291c1b6717d61. User requested the remaining transitTime warning fixed only from real policy, with no guesses. Git/Vercel deployment continues the authorized structured-data task.

## Evidence and seller confirmation

Current own-site terms, product, checkout and COMMERCE-POLICY only gave dispatch within2 business days. The older connected Drive commerce document says the same. A targeted Drive filename search found no separate Logen/parcel/delivery-policy contract; unrelated customer/order files were not opened. Same-owner Cafe24 guidance states3–7days without an after-dispatch starting point and uses different shipping fees; those values were not transferred. Logen FAQ states a next-day target with exceptions; Article14 default handover dates apply when a shipment note does not state a date. Neither establishes this shop's typical transit range. Source responses and source-selection reasons are saved in backups/shipping-policy-2026-10-31/research.json and referenced HTML originals.

The seller explicitly confirmed in this chat: general regions1business day after dispatch, Jeju/islands/remote within2days. A second answer confirms the remote2days are business days excluding Saturday/Sunday/public holidays. Original statements and the clarification question are preserved in seller-confirmation.json. This seller confirmation supplies the implementation values, replacing the earlier lack-of-evidence decision; no range was derived from carrier targets or Cafe24 totals.

## Implementation decisions

Product offers retain handlingTime0–2DAY and shipping prices. transitTime1–2DAY describes the national envelope; exact regional conditions are visible in product, checkout, terms and assistant responses. Monday–Friday businessDays uses Schema.org OpeningHoursSpecification without invented opening hours/cutoff. Google does not support KR regional/postcode shipping subdivisions, so one KR-wide destination is retained and no remote-area postcode list is fabricated. Public-holiday exclusions remain explicit in visible policy; weekday JSON-LD alone does not establish Korean holiday-aware Google arrival-date calculations.

## Verification and release status

Regression tests failed before implementation and pass afterward. Full suite285/285; independent review approved and independently ran13focused tests. Local Chrome1440/390px checks cover product/terms/checkout, visible regional policy, weekdays and no overflow. Browser evidence, full tests and independent review are in the dated backup. Final exact production READY, live148-product check, Google Rich Results Test warning state and actual completion are governed by backups/shipping-policy-2026-10-31/receipt.json. No price, stock, order, payment or account configuration changes are authorized by this task.

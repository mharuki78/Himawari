# Npay campaign activation continuation

> **For agentic workers:** Use superpowers:executing-plans and scoped implementation/review agents. Preserve completed work; keep progress in the execution log.

**Goal:** Complete reservation-bound ordinary/campaign/mixed Npay checkout, authenticated reconciliation and provider onboarding; enable production only after verified capability.

**Architecture:** Extend the existing shared-lock allocator. Persist one upstream registration result per immutable checkout. Poll authenticated order metadata and bind provider lines to reserved identities; release only proven cancelled quantities. Ordinary legacy IDs become non-purchasable after a controlled cutover. The existing display-only disabled card changes only when the backend reports verified support.

**Tech Stack:** Existing Node JavaScript, Neon HTTP transactions, Npay XML/1.11.0 metadata, PGlite tests; reuse pinned bcrypt/HTTPS proxy transport where appropriate.

**Spec:** ../specs/2026-11-12-npay-campaign.md and ../../NPAY-CAMPAIGN-INTEGRATION.md. User continuation instruction authorizes finishing the previously described approach without another design-choice round.

## Global constraints

- No actual customer/order/PII access or storage beyond a confirmed approval scope. Prior sandbox read approval was bounded and already used; production sync requires its own explicit scope.
- No real payment, cancellation/refund or paid plan change without explicit scoped approval.
- Unknown/expired registration never releases stock automatically. Completed polling is not collection finality.
- Keep unrelated dirty files and latest checkout UI; no incomplete public activation switch.

## Tasks

- [ ] Registration: idempotent request ID, single upstream attempt, persist successful BUY_KEY encrypted server-side, uncertain results remain held; ordinary/campaign/mixed use reserved products. Test retries, races, changed contents, network/parse failure.
- [ ] Settlement: authenticate upstream metadata, validate identity/option/price/quantity, bind unique provider order line under inventory lock, ignore stale/duplicate states; cancel-complete only releases proven quantities; returns do not imply stock physically restored. Test full/partial cancel, replay, reversal, mismatches and concurrency.
- [ ] Transport/worker: exact allowed hosts, HTTPS proxy TLS, bcrypt OAuth, bounded requests, token cache, safe error fields, sync cursor overlap and crash recovery; no private payload logging.
- [ ] Readiness/cutover: schema/worker/deployed endpoint readiness and provider issued credentials, block legacy unreserved purchase paths; campaign UI and cart use server capability and preserve locked prices/options.
- [ ] Verify synthetic complete lifecycle and Chrome PC/mobile; prepare exact sandbox/production approval and provider inspection work only after implementation is reviewable.
- [ ] Record real provider results; synchronize/deploy only verified scope. Claim Npay campaign completion only after real production readiness and checkout verification.

## Review focus

Lost registration response, tampered/replayed cart, legacy checkout already open at cutover, partial cancellation/return semantics, stale/out-of-order provider responses, and unavailable polling capacity must not silently release or overallocate stock.

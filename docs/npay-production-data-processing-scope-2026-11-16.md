# Npay production data processing — proposed approval scope

Status: approved by the owner2026-11-16. Initial bounded API read completed without private values in output. The owner subsequently chose the free Fixie plan and six collections per day; no paid upgrade is approved. Owner request: complete ordinary, campaign and mixed Npay checkout after production API issuance.

## Purpose and source

Use the issued Npay production order-management API to check the legacy transition and reconcile paid/cancelled quantities with the site's inventory reservations. Existing Sandbox approval does not cover production customer/order data.

## Bounded reads and ongoing operation

- Initial transition audit: changed orders in the preceding 48 hours, split into API-supported windows of at most 24 hours; maximum 40 authenticated HTTP requests in total. Stop on incomplete pagination, conflicting metadata or missing records. A complete interval is not proof that an old unpaid checkout can never be paid.
- After verified activation: authenticated scheduled reconciliation every four hours (six times daily); each invocation at most10 upstream requests, up to three changed-order pages, and order-detail batches of at most300 IDs. This narrows the earlier approved five-minute/20-request scope. Preserve the current one-hour overlap and bounded catch-up windows. On missing/stale/contradictory evidence, keep reservations and close new managed Npay checkout through the existing readiness guard.
- Read the site's existing Npay checkout/reservation/status records needed for this transition. Do not read unrelated account, customer or order tables.

## Data and destinations

Npay responses may contain names, phone numbers, email addresses and delivery addresses. Process the source response only in current-device/server memory and immediately project it to the existing whitelist. Do not put source responses or these contact/delivery values in files, logs, chat, screenshots, Git, support messages or analytics.

Retained operational metadata in the existing Neon production database: order/product-order identifiers, reserved product/option identities, quantities/prices, payment/cancellation/claim state and claim identifiers, timestamps, reconciliation cursor and aggregate incidents. Reservation snapshots contain public product names/options/images/prices. Registration results remain encrypted server-side. These operational rows currently have no automatic age-based deletion; a separate approved retention/deletion change must preserve reconciliation and inventory consistency.

Recipients/services: Npay production API, the site's Vercel server runtime, the existing Neon database, and the current device for bounded verification. Existing Fixie provides the TLS-verified fixed-IP connection; do not disable TLS validation. No new advertising/support recipients.

## Explicit exclusions

This scope does not authorize a real charge, refund, cancellation, paid plan upgrade, raw personal-data export or a new outbound support message. Real payment verification requires an exact separately approved basket/payee/amount or the owner's own payment action. Paid capacity requires its own amount/recurrence approval.

## Evidence before activation

Preserve issuance and Sandbox inspection evidence. Verify actual hosting schedule and fixed-IP capacity, old legacy product-information rejection, inventory consistency, genuine registered-origin PC/mobile flow, and fresh incident-free order reconciliation. Do not fabricate release-proof dates or delete uncertain reservations to obtain readiness.

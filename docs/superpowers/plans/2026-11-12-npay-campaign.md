# Campaign Npay preparation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Prevent incorrect campaign Npay registration and prepare price/option/stock XML for the verified protocol while documenting the activation prerequisite.

**Architecture:** Preserve ordinary Npay. Add a pure campaign projection module using validated campaign and product snapshots, stable bounded IDs, and explicit fail-closed readiness. Route campaign requests through server-side rejection until authenticated lifecycle/reservation integration exists. Do not enable an incomplete checkout.

**Tech Stack:** Existing JavaScript modules, Node test runner, existing Npay XML helpers; no new dependencies.

**Spec:** [Campaign boundary](../specs/2026-11-12-npay-campaign.md).

## Global Constraints

- Preserve unrelated AGENTS.md, DESIGN.md, STATE.md changes and production catalog/settings.
- Do not access real customers, orders, credentials or initiate payments.
- No invented provider protocol and no switch that activates unsupported stock handling.

## Tasks

- [x] Reproduce incorrect normal-price registration with a synthetic request and mocked upstream.
- [x] Reject campaign requests at the server; return explicit readiness in public configuration without secrets.
- [ ] Test and prepare campaign-bound product identities, XML price/option/availability, stale/closed handling, and mixed-list isolation.
- [x] Run focused and full regression tests, independent code review, verify unchanged ordinary Npay behavior.
- [x] Record official evidence, remaining activation requirements, and ask for narrowly scoped merchant onboarding access if needed.

## Execution ruling

2026-11-12: Defer campaign identity/XML implementation until the authenticated lifecycle and reservation contract is available. A future adapter's identity, reservation and settlement boundaries depend on that contract; unused projection code would not enable safe checkout. Ship the independently useful ordinary-price registration guard first. The user's complete campaign Npay request remains open. Merchant-account settings access approval has been requested; no response has been assumed.

# Npay release preparation — 2026-11-16

Task: npay-prep-20261116. Operator: Codex /root. The owner asked to continue Npay. Existing sandbox payment/cancellation and API-inspection submission approvals persist. This continuation does not add production customer/order access, real payments/refunds, paid subscriptions or a new external support message.

Fresh public review: #227 still has zero comments/Unanswered, and the latest domain follow-up in #222 has zero replies. The official issuance guide still requires completed sandbox inspection before a private production-issuance email. The connected anonymous merchant-center page redirects to login. A dedicated headed Google Chrome login window was opened and the owner was asked to sign in; credentials and API values must not be sent through chat.

Independent work: isolate a native managed worktree at `C:/Users/UserK/.codex/worktrees/npay-prep-20261116/Himawari` on `codex/npay-prep-20261116`. Preserve all unrelated dirty files in C:/Himawari. Baseline bc2747ac5d415771dbef0657420557d156c6c2e8 passed480tests. The feature branch is ahead of current main82822937f86cc9b3315b58268aa27f1c4ab7a003 by only three Npay commits affecting eight source/test files. A clean merge preserves current main's latest product actions/ribbon and new stories.

The release procedure and actual proxy-capacity arithmetic are in `docs/NPAY-PRODUCTION-CUTOVER.md`. These are preparations, not evidence of provider approval or production readiness. No production settings or proof timestamps have been changed. Integration tests, independent review and exact private preview verification remain to be recorded below.

Integrated verification passed482/482. Relative to current main, production-source differences are restricted to the four existing Npay modules and their four tests; all latest storefront/cart/order/story content is preserved. No new provider request or sandbox payment was performed for this merge. Independent review precedes pushing the existing sandbox branch.

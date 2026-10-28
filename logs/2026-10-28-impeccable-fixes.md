# Impeccable fixes and production release

- Date/timezone: 2026-10-28, Asia/Seoul
- Author: Codex; task ID: ui-fixes-2026-10-28
- User decision: implement all nine audited fixes, commit/push Git and deploy Vercel production.
- Workspace: C:/Himawari; initial main/origin/main: a96028db5b6fe14e5d58ff38d3d4d87bb0d5416b.
- Spec: docs/audits/impeccable-2026-10-28.md.
- Plan: docs/superpowers/plans/2026-10-28-impeccable-fixes.md.
- Preserve existing audit report/STATE change and unrelated untracked files; no article body/date/photo or product data edits.

## Checkpoint: implementation starting

Audit reproductions and source locations supply the baseline. Root causes: visual hiding without inert, whole-card opacity, always-expanded fixed controls, eager video sources, long secondary-control stacks, intrinsic grid widths and unbounded list rendering. Independent product/cart, discovery/checkout and story domains are delegated with exclusive file ownership. Controller owns home/media, integration, Chrome and release. Figma source is unavailable because no project file key/link was found in the prior audit; use existing DESIGN.md and approved site as visual authority.

Verification and release are pending. No production settings or customer records will be modified.

## Checkpoint: pre-release verification complete

All nine audited items are implemented. Product purchase disclosure is 110px closed at 320/390 widths (baseline 224.6px at 390); assistant/cart now occupy its reserved utility row. Closed drawer Tab focus stays visible and outside inert content; opening focuses close, Escape restores launcher. Product guidance stays within 320px viewport. Quantity 3 reaches bank/Kakao URLs and Npay dataset; sibling-product navigation retains quantity 3.

Catalog search/filter disclosure puts first product price at y746–780 on 390×844 (baseline first card y712). Search-empty/reset, horizontal Load more focus in both axes, criteria rail reset and breakpoint focus-to-summary passed Chrome checks. Checkout selected bank collapses method chooser, shows order summary before form (form y989 versus baseline y1768), preserves typed recipient on method change and keeps the official Npay chooser. Story renders 12, appends to 24 with visible first-new-link focus, searches the full 167 and resets to 12.

Both source videos are preserved. New H.264/AAC faststart files total 4,468,741 bytes desktop and 1,890,087 bytes mobile, versus 13,179,471 source bytes. Chrome confirms offscreen feature video remains unloaded, viewport exit pauses the hero, user pause persists, reduced motion leaves posters and permits manual play. Scoped axe contrast check on the reel showcase reports zero violations. Announcement and kicker labels are 12px.

Npay first-open real SDK markup was verified on the production origin with task-local changed assets supplied through this tab's Playwright route overrides. This is pre-release testing, not proof of a deployed change. All route overrides were removed afterward. No buy/order API was invoked. The SDK shows one official green button with a 334×58 container. Localhost alone shows its domain connection message and was not counted as a payment defect.

Meaningful review fixes included a late assistant stylesheet specificity override, catalog hidden breakpoint focus, scroll reset and visible appended focus, and legacy reduced-motion CSS that hid manual video controls. Independent reviewer approved current source with no remaining material findings. Final `npm test`: 270 passed, 0 failed; `git diff --check` and JavaScript syntax checks passed. Detector results remain advisory (incumbent design features and template path limitations); they are not counted as verified defects.

Evidence: backups/ui-fixes-2026-10-28/browser-evidence.json, final-tests.txt, media-sizes.json, screenshots and scoped detector files. Browser emulation covered 320/390/768/1440; physical devices, screen readers, real order/payment are unverified. Figma comparison remains unavailable without a project file key.

Next: push the named task files, confirm exact SHA production READY, and verify the live site without route overrides. Provider responses and final completion status will be saved in backups/ui-fixes-2026-10-28/receipt.json.

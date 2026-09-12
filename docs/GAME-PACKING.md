# Packing stage verification — 2026-09-12

- Uses the existing No.0422 product photograph and SVG opening/item layers; no human figure in the packing stage.
- One collected-item tap runs opening, insertion behind the pocket mask, and closing. Laptop is closed for insertion; bottle remains visible above the side pocket.
- 2.2-second insertion; input locked and packing clock paused. Reduced motion uses 250 ms feedback. Completion awards 150 once, then final result after 700 ms.
- Formal test directory: 118 passed, 0 failed. Includes duplicate taps, last-item sequencing, exit callback, reduced motion and clock suspension.
- DESIGN.md lint: 0 errors, 15 existing unused-token warnings.
- General `node --test` discovery also picked up four backup mail helpers that failed. Formal suite was rerun against `test/` only. No backup files are part of this change.
- Premium static audit reports 184 existing repository findings, including five game controls it cannot associate with external JS handlers. Changed item controls are bound in game.js and verified in browser. Audit output: backups/packing-ui-audit.json (local only).
- Browser: desktop and 390×844 layout; laptop/book, front-pocket and side-pocket states. Isolated visual fixture shortened approach and extended packing time, with all four items and no real coupon service. Production timing and coupon endpoint remain unchanged.

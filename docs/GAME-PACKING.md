# Packing stage verification — 2026-09-12

- Uses the existing No.0422 product photograph and SVG opening/item layers; no human figure in the packing stage.
- One collected-item tap runs opening, insertion behind the pocket mask, and closing. Laptop is closed for insertion; bottle remains visible above the side pocket.
- 2.2-second insertion; input locked and packing clock paused. Reduced motion uses 250 ms feedback. Completion awards 150 once, then final result after 700 ms.
- Formal test directory: 118 passed, 0 failed. Includes duplicate taps, last-item sequencing, exit callback, reduced motion and clock suspension.
- DESIGN.md lint: 0 errors, 15 existing unused-token warnings.
- General `node --test` discovery also picked up four backup mail helpers that failed. Formal suite was rerun against `test/` only. No backup files are part of this change.
- Premium static audit reports 184 existing repository findings, including five game controls it cannot associate with external JS handlers. Changed item controls are bound in game.js and verified in browser. Audit output: backups/packing-ui-audit.json (local only).
- Browser: desktop and 390×844 layout; laptop/book, front-pocket and side-pocket states. Isolated visual fixture shortened approach and extended packing time, with all four items and no real coupon service. Production timing and coupon endpoint remain unchanged.

## September 14 pixel-art revision
- Packing-only photo layers replaced with `assets/game-0422-pixel.png`. Marketing product photo stays photographic.
- Laptop/book insertion viewport enlarged from 120 to 300 SVG units (2.5x); visible width about 220 units against the roughly 380-unit bag body. Top travel 340 units completely clears the 164-unit mouth mask. Room above bag prevents clipping before insertion.
- Built-in image_gen style-transfer, reference `assets/game-0422-black.jpg`; source `C:/Users/UserK/.codex/generated_images/01a08495-edb2-74e2-b203-1f9e52e791cd/exec-e334a644-459e-4867-97d2-90df450acefc.png`.
- Prompt: Create a high-quality crisp 16-bit pixel-art sprite of this exact No.0422 black Himawari backpack, square front view on white, same silhouette and placement, top loop, shoulder straps, double zipper, rectangular front pocket, round left pouch, smiling right charm, brand patch; stepped charcoal highlights, no photographic texture, no person.
- Verified desktop laptop and 390px mobile book insertion screenshots; laptop completes +150 once, mobile has no horizontal overflow. Game packing/journey tests: 9 passed.

## Matching restored (September 14)
- Item selection no longer inserts automatically. Four native buttons over the SVG bag select main/laptop/front/side storage; keyboard and touch supported. Selection is exposed through aria-pressed.
- Wrong or missing selection announces guidance without points; correct match uses existing guarded insertion and delayed scoring.
- Pencil insertion enlarged 108 to 205 units; bottle 90x120 to 170x205, including stored bottle; masks and travel adjusted.
- Seven packing tests pass, including all four mappings, no-selection/wrong-match and duplicate matching. Desktop bottle wrong/right tested; 390px mobile pencil/front tested, targets 47px high and no horizontal overflow.

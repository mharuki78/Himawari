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


## BAG QUEST interface and direct input (2026-10-01)

- User requested the clean PACK THE BEAT presentation and mouse/finger control. `assets/game-layout.css` now owns the lobby, native modal session, HUD, pause and result presentation. Existing map, character, item sprites, SVG compartments and marketing photograph remain.
- PC click walks to a destination; dragging changes that destination. Mobile drag keeps the initial finger/character offset and stops on release. A short tap also sets a destination. Keyboard and the compact joystick remain alternatives. Pointer movement uses the original 39 percentage units/second and existing collision bounds; no teleport or bonus speed.
- Cancel, lost capture, resize, pause, exit and phase transitions reset the pointer. Keyboard/joystick override a pending destination. A second finger can jump or fire while moving. Native dialog traps focus; Escape/close returns to the lobby launch button. Packing receives focus on its first item.
- Image loading uses the three actual game assets, counts successful loads, blocks premature start and offers retry on failure. Coupons remain on hold per the user's decision; no promotion settings or server scoring rules changed.
- Formal suite: 177 passed. Geometry tests cover boundaries, finger offset, constant speed, diagonal normalization, frame cap, arrival and zero-time frames. Existing journey/packing tests still pass.
- Local browser: 1280px PC click/drag, keyboard interruption, jump/fire, pause/time freeze, Escape/focus return; Chrome touch events at 390×844 test offset, drag/release, tap, cancellation and a second-finger jump. 320×568 and 844×390 keep actions visible. Failed image load/retry, reduced motion, resize and automatic pause pass.
- Natural 35-second approach and packing completed in browser without altered timers or test globals: three correct items added 450 points, an incorrect compartment added none, result/restart reset correctly, and zero coupon claims were sent. Screenshots and reports are in ignored `backups/bagquest-2026-10-01/` and `output/playwright/`.
- Strict premium static audit: 301 repository findings. The 11 in game.html are external-handler detection false positives (shared menu, retry, sound, close, SVG compartment buttons, restart, resume and exit). Actual handlers are bound in script.js/game.js and covered by browser flows. No changed stylesheet findings. Backups and older unrelated routes are included by the repository-wide audit configuration.

Design reconciliation: the old pixel borders, inline console and joystick-only guidance in DESIGN.md were superseded by the user's clean-interface/direct-input request. The game-specific prose was updated; shared palette, storefront components and commerce contracts were preserved.

## Compact game titles and BAG QUEST loader (2026-10-01)

- Both game lobby titles now follow the catalog/menu title scale: 32–50px, mobile maximum 44px. Taglines use 18–20px and body copy 14px. Narrow rhythm reward rows wrap into two columns so the 320px layout stays within the screen.
- BAG QUEST has a separate full-screen native loading dialog, with a sage background, stitched backpack drawing and progress based on the three decoded game images. Cached images have a brief 600ms minimum presentation and 250ms exit; reduced motion skips both and stops the drawing animation. The start button stays disabled until all three images succeed.
- The loading dialog contains keyboard focus and keeps background controls inert. Failure preserves actual partial progress, focuses retry and leaves a home link available. Successful retry closes the loader and returns focus to start. JavaScript-disabled pages retain the existing explanatory message because the dialog starts closed.
- Validation: 177 tests passed; design lint has zero errors and 15 pre-existing token warnings. Browser checks passed for delayed images, 503 failure/retry, focus, Escape, reduced motion, 1280px/390px/320px typography, 844×390 loader fit, mouse movement/pause/exit and touch drag/release. No page exceptions or coupon claims. Reports and screenshots are saved under ignored `backups/game-loading-2026-10-01/` and `output/playwright/`.

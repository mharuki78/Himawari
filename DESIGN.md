---
name: "Himawari"
description: "A white, photo-led bag store with real catalogue colours and rounded icon controls."
colors:
  primary: "#202423"
  primary-hover: "#343a37"
  white: "#ffffff"
  neutral-panel: "#f5f5f7"
  neutral-photo: "#f7f7f9"
  neutral-footer: "#f7f7f8"
  neutral-border: "#e6e7e9"
  secondary-text: "#616163"
  forest-focus: "#315845"
  sage-fill: "#d6e8df"
  selected-outline: "#3c5a4b"
  mint-swatch: "#bed8cc"
  pink-swatch: "#dfbfc4"
  blue-swatch: "#273d50"
  yellow-swatch: "#d8ad39"
  purple-swatch: "#66516c"
  black-swatch: "#343a3a"
  khaki-swatch: "#8c9273"
  ivory-swatch: "#e7e1d1"
  silver-swatch: "#b6babb"
  gray-swatch: "#898d8c"
  beige-swatch: "#cdbb9f"
  brown-swatch: "#94745f"
  red-swatch: "#b45353"
  orange-swatch: "#d08a51"
  green-swatch: "#648b72"
  navy-swatch: "#34495a"
  white-swatch: "#f4f1e9"
  peach-swatch: "#e4b39f"
  lavender-swatch: "#b8a3d1"
  sky-swatch: "#a8c6d4"
  burgundy-swatch: "#824f59"
  coral-swatch: "#df9e8e"
  mint-tint: "#edf5f1"
  pink-tint: "#fcf1f3"
  blue-tint: "#edf1f5"
  yellow-tint: "#faf4dd"
  purple-tint: "#f3eef6"
  black-tint: "#f2f3f3"
  khaki-tint: "#f2f3ec"
  ivory-tint: "#faf8f2"
  silver-tint: "#f3f5f5"
  gray-tint: "#f2f3f3"
  beige-tint: "#f7f2e9"
  brown-tint: "#f5eeea"
  red-tint: "#fbefef"
  orange-tint: "#fbf1e7"
  green-tint: "#edf5ef"
  navy-tint: "#eef2f5"
  white-tint: "#f7f7f4"
  peach-tint: "#fcf0e9"
  lavender-tint: "#f4effa"
  sky-tint: "#eef6fa"
  burgundy-tint: "#f6eef0"
  coral-tint: "#fcf0ed"
typography:
  display:
    fontFamily: '"Pretendard Local", "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
    fontWeight: 700
    lineHeight: "1.13"
    letterSpacing: "-0.04em"
  title:
    fontFamily: '"Pretendard Local", "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "1.5"
    letterSpacing: "-0.02em"
  body:
    fontFamily: '"Pretendard Local", "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "1.78"
    letterSpacing: "-0.018em"
  navigation:
    fontFamily: '"Pretendard Local", "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
    fontSize: "13px"
    fontWeight: 550
    lineHeight: "1.4"
    letterSpacing: "0px"
  action:
    fontFamily: '"Pretendard Local", "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
    fontSize: "13px"
    fontWeight: 650
    letterSpacing: "0px"
  utility:
    fontFamily: '"Pretendard Local", "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
    fontSize: "12px"
    lineHeight: "1.6"
rounded:
  field: "12px"
  soft: "16px"
  icon: "18px"
  card: "24px"
  panel-mobile: "26px"
  feature: "28px"
  panel: "30px"
  pill: "999px"
spacing:
  compact: "8px"
  field: "12px 14px"
  control-gap: "16px"
  gutter-small: "20px"
  content: "24px"
  group: "28px"
  section-head: "32px"
  page: "clamp(20px, 4.5vw, 72px)"
  section: "clamp(60px, 7vw, 100px)"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    typography: "{typography.action}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.white}"
  button-secondary:
    backgroundColor: "{colors.neutral-panel}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    height: "44px"
  button-icon:
    backgroundColor: "{colors.neutral-panel}"
    textColor: "{colors.primary}"
    rounded: "{rounded.soft}"
    padding: "0"
    width: "44px"
    height: "44px"
  navigation:
    backgroundColor: "{colors.neutral-panel}"
    textColor: "{colors.primary}"
    typography: "{typography.navigation}"
    rounded: "{rounded.pill}"
    padding: "6px"
  colour-swatch:
    textColor: "{colors.primary}"
    rounded: "20px"
    padding: "3px 4px"
    height: "64px"
    width: "44px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "{spacing.field}"
    height: "48px"
  product-information:
    backgroundColor: "{colors.neutral-photo}"
    textColor: "{colors.primary}"
    rounded: "{rounded.feature}"
    padding: "clamp(24px, 4vw, 52px)"
  app-shortcut:
    textColor: "{colors.primary}"
    rounded: "{rounded.icon}"
    width: "58px"
    height: "58px"
  colour-panel:
    backgroundColor: "{colors.mint-tint}"
    rounded: "{rounded.panel}"
    padding: "22px"
---

# Design System: Himawari

## Overview

**Creative North Star: "Choose a Colour, Meet the Bag"**

White space, original Himawari photography and the bags' varied colours carry the public brand. Visitors can recognise a real model and colour before opening its current product information. Dark, compact actions and consistent rounded icon controls keep the photography prominent. The official logo and established Korean brand statement remain identity assets.

The approved direction combines photo-led presentation with Apple-like capsules and rounded-square controls. Use the implemented Phosphor SVG family, original product proportions and short Korean labels. Colour is a product discovery cue; the action hierarchy remains stable as the selected bag changes.

This records the approved public-site implementation on 2026-10-30. Its final theme is assets/site-redesign.css, loaded after legacy page styles and the locally generated, prefixed daisyUI button stylesheet. assets/home-colours.js owns catalogue-linked swatches and tints; assets/site-ui.source.js, script.js and assets/member.js own their interactions. Existing page layout files continue to own specialised grids. Administration retains its existing stylesheet and operating interface; these public tokens do not redefine it. Product, checkout, account, game and story data contracts remain in their implementation and policy documents.

**Key Characteristics:**
- White canvas and real, uncropped product imagery.
- A fresh catalogue model on each visit, followed by that model's valid colour choices.
- Dark actions, readable Korean type and restrained neutral surfaces.
- Capsule navigation, rounded-square utility controls and labelled colour choices.
- Small, product-linked pastel surfaces rather than full-page colour skins.
- Existing catalogue, shopping and content flows carried into the new visual system.

## Colors

The palette is neutral at the page level, with product-linked colours used for discovery and soft contextual surfaces.

### Primary

- **Bag Ink** (primary): body text, dominant headings and the main product action. primary-hover deepens the action's pointer state without changing its meaning.
- **Forest Focus** (forest-focus): keyboard outlines, the caret and restrained link emphasis. selected-outline identifies the current colour independently of the swatch fill.

### Secondary

- **Catalogue Colours** (*-swatch): the 22 named interface approximations in assets/home-colours.js: mint, pink, blue, yellow, purple, black, khaki, ivory, silver, gray, beige, brown, red, orange, green, navy, white, peach, lavender, sky, burgundy and coral. Show only colours that resolve to valid products in the selected model. These are editorial screen values, not physical colour measurements or permission to recolour product photography.
- **Catalogue Washes** (*-tint): the corresponding photo-panel surfaces for those 22 named colours. Black and gray intentionally share one source tint value. Mint, pink, purple and yellow also appear in the compact information strip.
- **Soft Sage** (sage-fill): supporting purchase actions and text selection. It remains a small supporting fill within the white system.

### Neutral

- **White** (white): page canvas, product-image background, fields and navigation's active surface.
- **Quiet Panel** (neutral-panel): navigation track, icon controls and utility surfaces.
- **Photo Neutral** (neutral-photo): product media and form-container backgrounds.
- **Footer Neutral** (neutral-footer): the legal and navigation footer.
- **Hairline** (neutral-border): dividers, field borders and restrained boundaries.
- **Secondary Ink** (secondary-text): supporting copy and captions on light neutral surfaces.

**The Real Colour Rule.** Change the selected photo, label, selected state and detail destination together after the image has decoded; never tint a bag photograph with CSS.

**The Stable Action Rule.** Keep the primary action dark when the product colour changes. Use a text label and a check or outline with selected swatches so colour is never the sole signal.

Legacy names such as sage canvas, cream and deep grove remain compatibility aliases. Their final public values come from the new theme; historical names do not authorise restoring the old sage page background. Specialist components still consuming older local tokens are local inheritance, not additional global brand accents.

## Typography

**Display and Body Font:** locally hosted Pretendard Variable, registered as **Pretendard Local**, with the frontmatter stack. The font supports weights 100–900. Platform fonts are fallbacks, not the selected display voice.

**Character:** compact Korean sans lettering, clear weight changes and short headings. Preserve meaningful Korean word groups and original product names. Prices and the current product selection use tabular numerals.

### Hierarchy

- **Display:** the frontmatter role is the main colour heading. Its source size is clamp(46px, 4.8vw, 72px), preserved in the sidecar because the installed portable linter accepts only fixed dimensions in this typography field. It is 50px at the tablet breakpoint, 48px with 1.15 line height on mobile, and 44px at the narrowest breakpoint. One heading leads a viewport.
- **Section headings:** the home section scale is 30–44px with 1.25 line height; contact and campaign copy retain their measured local scale. These exceptions do not define another display role.
- **Title:** the frontmatter role describes compact product names. Journal titles use 20px on desktop and 18px on mobile, with inherited weight 650.
- **Body:** the global frontmatter default. Hero supporting copy uses 16px with 1.75 line height, reducing to 15px on mobile. Longer brand copy has local 1.8–1.85 line height. The inherited paragraph measure is 40ch; do not stretch it to fill wide image columns.
- **Navigation and action:** the corresponding frontmatter roles; labels are concise and sentence case.
- **Utility:** captions, state messages and swatch labels are at least 12px in the redesigned discovery surface. Mobile form inputs remain 16px.

The source still carries editorial eyebrows and some section-heading tracking tighter than -0.04em. These are inherited craft drift, not reusable typography roles; their styles are deliberately absent from the normative token set.

## Layout

The public gutter is fluid through the frontmatter page spacing token. Homepage sections share one centred content rail: a maximum of 1320px, with 20–72px fluid side gutters. The colour hero keeps its 0.9/1.1 split with no additional copy inset. Campaign films, the product grid, stories, game, reels and contact align to that rail; the FAQ has a padded panel inside it. Compact catalogue and brand layouts retain their local rails. Homepage refinements are scoped to `.home-page` so they do not redefine catalogue layouts.

The header is sticky and 82px high on desktop. Its translucent white surface uses an 18px backdrop blur to preserve navigation readability over scrolling content. At 1320px it becomes a 74px header and navigation becomes an expandable two-column white menu; at 760px the header is 72px. External-store destinations remain accessible through their existing routes when the mobile utility control is hidden.

At 760px and below, the colour hero becomes one column with 20px side gutters, 28px top space and a square product photo. Utility targets remain at least 44px. Swatches retain at least 44px width and 64px height; their visible circles are 34px. The colour capsule contains its own horizontal overflow when a model has many colours, keeping the page width stable.

Home sections follow the fluid frontmatter spacing on desktop and 58px vertical padding on mobile. Product grids retain a contained mobile swipe rail with 88% card width, a visible next-card edge and scroll snapping. The home collection starts with nine families and appends nine per labelled load-more action, preserving count announcements and focus transfer. The home journal is three columns on desktop and one on mobile.

Product-image frames reserve space and use object-fit: contain. Lifestyle and journal photos may retain their editorial crop. The campaign film retains its original 16:9 media treatment, with mobile copy stacked below. Inquiry fields use a paired first row on desktop and one column on mobile. Keep fixed support and purchase controls clear of each other and respect the purchase-bar offset.

## Elevation & Depth

The public system is flat by default. Photographs, white space, neutral surface changes and hairlines establish hierarchy. The final theme disables the old button, card and header-control offset-shadow tokens. Small soft shadows explain floating surfaces or tactile app shortcuts.

### Shadow Vocabulary

- **External-store float:** `0 12px 36px #20242314` on the external-store picker panel.
- **Photo whisper:** `0 12px 38px #23483b05` on the colour photo panel.
- **App shortcut:** `inset 0 1px 1px #ffffff80, 0 3px 8px #2024230a` on the small gradient icon tile.
- **Support float:** `0 4px 16px #2024230a` on the support launcher.

**The Flat Surface Rule.** Use no shadow for ordinary product cards or primary buttons. Reserve the named soft shadows for their existing components rather than making every rounded surface float.

## Shapes

Small actions and navigation use capsules. Utility buttons are 44px rounded squares with the soft radius; their SVG glyphs are 22px. App shortcuts have an 18px corner radius and 27px glyphs inside a 58px tile on wide screens, 56px on mobile and 52px in compact tablet or narrow layouts. These are CSS rounded squares, not mathematical superellipse masks.

Fields use the field radius, shared media and dialogs use the card radius, and larger containers use the feature or panel radius. The colour panel reduces to the mobile-panel radius at 760px; its inner photo changes from 21px on desktop to 18px on mobile. Product cards need no enclosing rounded box when the photo already supplies the shape. Preserve the official logo's geometry and colours; the light footer uses its original identity treatment.

## Components

### Buttons

Dark, compact and explicit. The principal product action follows button-primary with icon and text; its final directional glyph is smaller. Direct purchase actions share the dark hierarchy. Supporting cart and detail actions may use white, quiet neutral or soft sage surfaces. Keep existing destinations and enabled/disabled logic. Official Npay and authentication provider branding retain their prescribed treatment.

Hover darkens the primary action. Utility controls shift to the observed slightly darker neutral hover fill. Fine-pointer press feedback scales icon controls to 0.97; it is not persistent. Keyboard focus has a forest outline, 2px wide and 4px outside the control. Preserve component-specific focus treatments that add a ring. Disabled and submitting states keep labels and layout stable.

### Colour choices

Each visit selects a random valid product family from the current public catalogue, then a random initial colour from that family's actual variants. When multiple eligible families exist, exclude the last successfully displayed family, stored locally after image decode. If storage is unavailable, random selection still works. Prefer a non-set product when the same family and colour has both a standalone and a set listing. Browser back/forward cache retains its existing valid selection rather than starting another visit.

Labelled samples sit in one neutral, horizontally contained capsule. Selection uses an outline and inline check; derive a dark or white check from the actual swatch's luminance and contrast, never its position. Expose selection with aria-pressed. On enhanced first paint, a neutral loading panel conceals the static fallback model and photo. Insert the decoded image itself before publishing its model, labels, swatches, caption and destination together. Catalogue, first-image or bundle failures expose recovery and catalogue access after a bounded wait. A later failed colour switch preserves the existing matching selection. Without JavaScript the factual static photo remains usable. An empty colour set does not create imaginary products.

The authored colour transition uses Anime.js: opacity 0.5 to 1 and a 6px vertical settle over 260ms with outQuad. Reduced motion commits the state without animation. Cancel previous animation and obsolete results during rapid changes; clean up listeners when the page leaves the document lifecycle.

### Cards / Containers

Product photography leads; information aligns beneath or alongside it. Home product cards are flat, borderless outer structures with rounded neutral media. Featured information uses the frontmatter container surface and 24px mobile padding. Keep full product names, real prices, options and existing purchase actions. Do not synthesize unavailable facts to fill a layout.

Journal cards reuse published imagery, titles, summaries and links. The story area uses the ordinary browser cursor; the former pencil cursor and trail canvas have been removed. The support assistant uses a white panel, mint-tint header, neutral quick prompts and light message bubbles; the former yellow skin is superseded by the final public theme. Member and cart panels retain their behavior with the common card radius.

### Inputs / Fields

White fields, a hairline border, the field radius and inherited Korean typography. The home contact form supplies the frontmatter input dimensions; textareas are 140px high. Put validation beside the relevant input and preserve aria-invalid, labels and consent requirements. Keep native select ownership for product options and system pickers; visual redesign does not replace data behavior.

### Navigation

All eight desktop routes are directly visible in the quiet capsule track: bags, finder, lookbook, stories, guidebook, brand, game and contact. Each combines a Phosphor SVG icon with readable text. The active or hovered route gains a white surface. Do not hide routes behind a More disclosure. Header utility controls have a hoverable, dismissible tooltip on pointer hover and keyboard focus; labels follow the current account, cart, menu and store state.

Expanded mobile navigation exposes all eight routes in two columns and an account action. Opening moves focus to its first route; Escape restores menu-button focus. Preserve focus containment and close-on-navigation behavior. Search, account and cart remain individually labelled utility controls. Original external-store destinations remain in their picker.

### App shortcuts and iconography

Use the installed Phosphor SVG assets consistently. Shortcuts combine an SVG glyph, a soft peach/mint/lavender/yellow gradient tile and a visible label. This user-approved tile treatment does not define a page-background system. Sidecar previews inline equivalent SVG assets without package or icon-font dependencies.

### Existing specialised interfaces

Games retain their pixel-art world, controls, pause/result dialogs and reduced-motion behavior. Comparison retains three real-photo selections and its contained table. Product guidance retains confirmed specifications and its responsive image/specification split. Checkout, coupons, member state, wishlist, private inquiry, story feed and support preserve their existing source of truth. Administration's data-entry and destructive-action patterns remain local to its unchanged interface.

## Do's and Don'ts

### Do:

- **Do** use the white canvas, original logo and actual catalogue photographs to establish the brand.
- **Do** keep the product model, photo, colour label, selected state and product destination in sync.
- **Do** use dark primary actions, labelled SVG controls and visible keyboard focus.
- **Do** expose all eight desktop routes directly and preserve their mobile menu destinations.
- **Do** preserve the bag's full shape with contained product imagery and reserved image space.
- **Do** keep utility targets at least 44px and redesigned small labels at least 12px.
- **Do** respect reduced motion and preserve honest loading, error and empty states.
- **Do** retain current catalogue, commerce, account and published-content contracts when extending the interface.

### Don't:

- **Don't** restore the former full-page sage canvas or hard offset action shadows on redesigned public surfaces.
- **Don't** recolour product photography or describe interface swatches as measured physical colours.
- **Don't** change the primary action's meaning or colour hierarchy for each selected bag.
- **Don't** substitute invented claims, prices, stock, specifications or customer experiences for missing data.
- **Don't** use generated editorial or AI lookbook scenes as factual sales photographs; retain their disclosure.
- **Don't** make emoji, text glyphs or extracted Apple symbols the interface icon system.
- **Don't** propagate inherited eyebrows or overly tight section-heading tracking as new system rules.
- **Don't** reintroduce the removed story pencil cursor or trail effect.

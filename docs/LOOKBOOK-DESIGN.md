# LookBook surface

Mode: Experience. Extend the existing Himawari visual identity.

The photograph leads. Use the existing near-white sage canvas, forest text and header/footer. A compact title and short Korean introduction precede a date-grouped photographic gallery. Portraits have generous uninterrupted space, staggered desktop alignment and a single mobile column. Captions identify scene, actual model and colour; the product link is separate from the image enlargement action.

Native dialog provides focused full-image viewing, previous/next controls, Escape, restored focus and a product link. All galleries and product links remain available without JavaScript. Filtering and progressive display enhance the static HTML. Respect reduced motion and visible keyboard focus. Never replace product photography with abstract decoration.

Daily publication appends 2–3 new looks and rebuilds the archive; it never replaces prior days. First launch uses 3. AI disclosure is visible beside the introduction and in the viewer. Preserve real product attributes and proportions; neither captions nor generated images establish product specifications.

## Implemented surface patterns

The gallery inherits the shared Manrope/Pretendard font stack, header/footer, `--cream` canvas and `--harbor` heading colour from `styles.css`. Its local stylesheet does not redefine the site tokens. The page title scales from 42 to 76px at weight 600; scene titles use 20px at weight 600, with quiet 13px product metadata.

The archive is capped at 1200px. Three portrait columns have 28px gaps and the second and third photographs begin 60px and 28px lower; groups containing two or one photographs adjust their column count. At 820px and below, every group becomes one column with 20px outer margins and no stagger. Photographs keep a 2:3 presentation, 12px corners and unboxed captions. These are gallery-specific patterns, not replacements for the site's product-card geometry.

Local supporting tones stay within the inherited sage/forest palette: muted text (`#5b665e`), dividers (`#ccd4ca`), selected filters (`#4f6b58`) and keyboard focus (`#467154`). The viewer uses a near-white sage copy surface (`#f9fbf6`), dark forest image surround (`#17251c`) and a translucent dark backdrop. Filter pills and circular viewer controls maintain 44px targets. The only local transition is a 150ms enlargement-control background change, enabled when reduced motion is not requested.

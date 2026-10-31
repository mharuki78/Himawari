# Homepage schema recheck after UI refinement

Baseline: `52ca2a2ac8a19f18cc3282f901d75368b5c39745`. Scope: the current homepage, rendered content on desktop/mobile, metadata, and linked identity/assets. Live verification and exact release status: `backups/home-schema-2026-10-31/receipt.json`.

## Findings

The four JSON-LD entities remain correct: OnlineStore, WebSite, WebPage and FAQPage. Business name, contact details, address, logo, canonical URL, language and identity links match the current page. All six FAQ questions and answers match visible content. The store image is still the visible No.9007 campaign poster, now in the second section. The random hero does not declare a fixed Product or Offer.

The new No.1884 game promotion, navigation and campaign sections do not each require another schema entity. `hasPart` referencing the FAQ is a partial relationship, not an exhaustive inventory of the homepage. No required missing property or factual JSON-LD mismatch was found. Existing markup is preserved.

## Small metadata improvements

- Align `og:image` with the current visible campaign poster and `OnlineStore.image`, using the existing `assets/hero-9007-poster.jpg`.
- Add `og:site_name: Himawari` to match `WebSite.name` and the visible brand.

These are Open Graph consistency improvements, not invalid-JSON-LD repairs. The previous sharing photograph was not inherently invalid merely because it was no longer shown as that asset on the homepage.

An added consistency assertion failed on the previous sharing image before the correction. Focused tests6/6 and the full298-test suite pass. An independent read-only review found no actionable issue. No UI styles, text, product facts, stories, approved photographs or publication timestamps changed.

## Eligibility and limits

No VideoObject was added: a verified first publication time for the videos is unavailable, and this product-discovery homepage is not a dedicated watch page. No date, duration, rating, offer, game price or supported platform was invented to fill optional markup. Existing visible FAQ semantics are retained; no Google FAQ rich-result appearance is promised.

Official validator results, raw live JSON-LD/FAQ comparisons, desktop/mobile evidence, deployment provider response and tests are held under the receipt directory. Search Console indexing and actual search-result appearance are outside this validation.

## Primary references

[Google structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), [supported features](https://developers.google.com/search/docs/appearance/structured-data/search-gallery), [organization identity](https://developers.google.com/search/docs/appearance/structured-data/organization), [site names and Open Graph consistency](https://developers.google.com/search/docs/appearance/site-names), [video required fields](https://developers.google.com/search/docs/appearance/structured-data/video).

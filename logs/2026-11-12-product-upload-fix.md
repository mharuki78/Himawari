# Product image upload recovery — 2026-11-12

Task ID: product-upload-fix-2026-11-12. Owner: Codex /root. Timezone: Asia/Seoul.

The user reported that the product registration form remained on “제품 등록 중” after selecting/uploading files. This is the product image/create flow, not CSV import.

## Confirmed cause

The production page's connect-src did not permit the installed Vercel Blob SDK's default API at `https://vercel.com/api/blob`. Chrome reproduced a connect-src violation for that exact API; the installed SDK retries network errors up to ten times, leaving the existing unbounded upload promise and disabled submit button pending. Screenshot's visible upload-cancel control is consistent with this phase. No customer/member/order data was required.

Official SDK protocol reference: https://vercel.com/docs/vercel-blob/using-blob-sdk and https://vercel.com/docs/vercel-blob/client-upload. The actual endpoint and retry behavior were verified against the installed module and production Chrome CSP, rather than inferred from documentation alone.

## Fix

- Permit only the exact Blob API path and its subpaths in connect-src; retain the existing host restrictions and other security directives.
- Bound product image uploads by a 60-second no-progress deadline and five-minute per-image total deadline. Cancel aborts the SDK and releases the form even if an underlying promise never settles.
- Keep the existing POST/PATCH save lifecycle and server request-ID duplicate protection. Deadlines apply to image transfer and temporary-media cleanup; no new product-save timeout or uncertain-write cleanup transition is introduced.
- Bound temporary-image cleanup requests, keep the current progress indicator, and label the image upload stage explicitly. Cache-bust the rebuilt admin bundle.
- No prices, stock, orders, member accounts, payment settings, or existing product images are changed by this fix.

## Evidence and release

Full-suite evidence is in `backups/product-upload-fix-2026-11-12/tests.txt`. Unit tests cover CSP, stalled/advancing uploads, restarted retry counters, cancellation, late SDK progress, maximum duration and bounded media cleanup. An isolated real admin handler test verifies two identical registration requests produce one product and one catalog write. The Blob test harness now includes image metadata required by real ownership validation.

Chrome four-scenario evidence is in `backups/product-upload-fix-2026-11-12/browser-verification.json`: desktop/mobile normal registration using the actual Blob SDK and real admin API with independent memory stores; manual cancellation; and a stalled upload. Interrupted flows keep inputs, buttons recover, and no CSP connection violations occur under the fixed policy. Timeout timers were accelerated only inside the isolated QA contexts. Independent review identified uncertainty risks in a proposed save deadline; that proposal was removed before release, preserving the existing save lifecycle.

Production release and a single owned temporary-image upload/cleanup probe remain in progress. No test product will be created in production. Exact commit/production READY, live Blob transport result, cleanup, unchanged product catalog, final asset hashes and completion status will be recorded in `backups/product-upload-fix-2026-11-12/deployment-receipt.json`. Task-created contexts and helper servers will be closed. The existing stalled tab must reload the new document policy/bundle; select its file again when retrying.

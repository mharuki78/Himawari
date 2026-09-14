# Social login and support assistant — 2026-09-14

## Deployed behavior
- Naver existing production configuration verified to reach the official Himawari authentication screen; first OAuth sign-in creates a member through existing upsertOAuthUser. No user sign-in completed during verification.
- Kakao OAuth implementation uses state-bound callback, client secret, verified email only and separate provider identity. No automatic email-based account merging. Enabled only after KAKAO_LOGIN_ENABLED=true and both keys exist. Database provider constraint migration completed.
- Right-side support assistant loads via shared member.js on public pages, hidden during active games. Official-guidance answers work without an AI account. It does not access orders, process payments or register inquiries. Escalation links use existing private inquiry flow.
- Current AI mode OFF. Optional Responses API paraphrases matched verified guidance only, requires explicit visitor opt-in, no conversation history or server chat storage, store:false, timeout fallback to guidance. Unknown questions go to contact.
- Local rate limiting: 15/minute per IP per server instance, bounded map. Before enabling paid AI, configure account spend limits and consider shared rate limits for higher traffic. Do not treat instance-local throttling as a global quota.
- Guidance source: terms.html article-13 (shipping) and care.html/support.html. Update api/_lib/assistant.js when store policy changes.

## Required setup to finish Kakao
1. Sign in to https://developers.kakao.com and create the Himawari app; user completes account agreements.
2. Enable Kakao Login, add web domain https://himawari.co.kr and redirect URI https://himawari.co.kr/api/auth/callback/kakao.
3. Configure profile consent; email is optional to our implementation.
4. Store REST API key as KAKAO_CLIENT_ID and client secret as KAKAO_CLIENT_SECRET in Vercel production. Do not paste secrets into chat.
5. Migration scripts/migrate-kakao.mjs already ran on production. Set KAKAO_LOGIN_ENABLED=true, deploy, then test actual consent/callback/MY/logout using the user's account.
Documentation: https://developers.kakao.com/docs/ko/kakaologin/rest-api

## Required setup to finish AI
1. User creates an API account and billing/spend limit at https://platform.openai.com.
2. Store OPENAI_API_KEY and desired supported SUPPORT_AI_MODEL in Vercel; set SUPPORT_AI_ENABLED=true only after privacy notice review and cost configuration.
3. Redeploy and test opted-in AI responses, timeout fallback, and instruction-boundary behavior. Until then the widget clearly uses official-guidance automatic answers; no claim that generative AI is live.
API: https://developers.openai.com/api/reference/cli/resources/responses/methods/create

## Verification
Auth and assistant tests: 8 passed. Local browser verifies guide delivery and mobile interaction. Actual Naver provider redirect verified; Kakao and paid AI cannot be tested without user accounts.


## 2026-09-14: Catalog-aware product consultation

AI replies are enabled by default in production. Product questions read the same managed catalog as the storefront, retrieve up to 18 candidates using use case, model, color and budget, and provide registered descriptions/specifications to the model. Sold-out products are excluded. Model-selected IDs are resolved back to catalog-owned image, name, price and detail links (at most three cards); seed fallback never presents a stale price. General care advice is distinguished from registered model-specific care instructions.

The browser keeps up to three recent product questions and last suggested IDs in memory for follow-ups. The server filters contact/order data from this context. Account identity changes clear it. Authenticated order lookup still bypasses AI; no order result or account profile is sent. Ordinary service questions retain the existing verified policy guidance and API failure fallback.

Validation: `node --test test/assistant*.test.mjs` (pass explicit paths on Windows).


General consultation now includes bag construction/materials, fit and strap adjustment, packing and laptop fit checks, zipper/hardware troubleshooting, cleaning and storage. General knowledge is allowed and must be distinguished from verified model-specific facts. Unrecognized wording also reaches the expert prompt rather than an automatic contact-only answer. Informational answers do not require product cards or sales recommendations. Private orders and published service policies keep their previous authoritative paths.

# UX Contract

## Product context

- Audience: 공개 고객과 단일 Himawari 관리자
- Primary jobs: 고객은 제품별 상세 정보를 확인하고 문의를 비공개로 접수한다. 관리자는 제품과 이미지를 등록·영구 삭제하고 문의를 읽은 뒤 필요할 때 영구 삭제한다.
- Target market(s): 대한민국
- Active locales: `ko-KR`
- Language/content register: 공개 화면은 절제된 브랜드 문장, 관리자 화면은 짧고 구체적인 업무 문장
- Timezone/calendar policy: 접수 일시는 `Asia/Seoul`, 그레고리력으로 표시하고 서버에는 ISO 8601 UTC로 저장한다.
- Accessibility target: WCAG 2.2 AA

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Permission model | `docs/INQUIRY-POLICY.md` | Maintained product policy | 2026-08-31 |
| Data lifecycle | `docs/INQUIRY-POLICY.md` | Maintained product policy | 2026-08-31 |
| Deletion / retention | `docs/INQUIRY-POLICY.md` | User-approved product policy | 2026-08-31 |
| Legal / regulatory copy | 공개 폼의 운영 안내만 확정됨; 별도 법률 검토 자료 없음 | Release risk | 2026-08-31 |
| Market / content conventions | `DESIGN.md` | Design/content guide | 2026-08-31 |
| Product permission / lifecycle | `docs/PRODUCT-CATALOG-POLICY.md` | User-approved product policy | 2026-08-31 |
| Product media limits / storage | `docs/PRODUCT-CATALOG-POLICY.md` | Maintained product policy | 2026-08-31 |

## Visual contract

- Project `DESIGN.md`: `DESIGN.md`
- Token ownership model: existing runtime canonical (Model B)
- Runtime design-system/token source: 공개 `styles.css`, 공개 제품 `assets/gear.css`, 관리자 `admin/admin.css`
- Mapping/adapters: `assets/gear.css`가 제품 상세를 포함한 공개 화면의 기본 토큰을 소비하고, 관리자 문의·제품 화면은 동일 브랜드 토큰에 삭제 전용 `danger`를 추가한다.
- Token drift gate: `designmd lint`, 변경 색상과 CSS 변수 정적 비교, 공개/관리자 브라우저 확인
- Supported themes: light only; 관리자 화면은 크림 바탕 제품 레지스터

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | `assets/inquiry-form.js`, `admin/admin.js`, `admin/product-admin.source.js` | API validation | public inquiry / admin login / product create | validation + browser flow |
| File upload | native file picker + `@vercel/blob/client` upload queue | `api/admin/product-upload.js` | main image / gallery | type-size-owner + progress/cancel browser flow |
| Scrollbar | global application stylesheets | CSS tokens | product scroll geometry only | computed style |
| Status | form/list inline live regions | current request state | success / error / pending | live-region inspection |
| CRUD | inquiry and product APIs under `api/` | server authorization + Blob policies | inquiry create/read/delete / product create/read/delete | full-flow integration |
| Dialog | native modal `<dialog>` with app-owned surface | `admin/inquiries.html` | irreversible delete only | keyboard + failure flow |

## Component behavior

| Component | Default | Hover | Focus | Active | Disabled | Busy | Error |
|---|---|---|---|---|---|---|---|
| Button | hairline or solid | ink/moss inversion | cream inner + moss outer ring | darker semantic surface | reduced opacity, no action | label changes, size fixed | inline status nearby |
| Secret input | masked | n/a | visible ring | n/a | n/a | login button owns busy | associated Korean error |
| Input | underline | stable | underline + global ring | n/a | reduced opacity | form owns busy | `aria-invalid` + inline text |
| Textarea | resize none, 6–7 rows | stable | underline + global ring | n/a | reduced opacity | form owns busy | associated Korean error |
| Table/list | 20 newest records | row tint | real view button | selected detail visible | n/a | stable reserved region | persistent retry state |
| Upload queue | native picker + preview | dashed border tint | visible global ring | selected preview | locked during save | determinate aggregate progress + cancel | file or persistent form error |

## Dataset navigation

- Admin tables: private Blob cursor pagination, 20 records per request
- Product admin table: catalog offset cursor, 20 products per request; total count and explicit load-more
- Public product catalog: complete bounded catalog for browsing; product detail reads by stable public product ID
- Exploratory lists: none
- URL state: Blob cursor is transient and not put in the URL; no PII or private record identifier enters browser history.
- Empty/no-results/error/loading treatment: distinct loading, empty dataset, persistent error with retry; search/no-results is not part of this version.
- Back/scroll restoration: one admin route; load-more appends without moving scroll.
- Selection: single record detail only; no bulk selection or bulk delete.

## Flow ledger

| Operation | Trigger | Pending | Success destination | Success feedback | Failure recovery | Focus outcome | Source ref |
|---|---|---|---|---|---|---|---|
| Create inquiry | `비공개 문의 접수` | button locked, stable label slot | same form | inline server-confirmed receipt | values retained, retry with same request ID | remains in form/status | `docs/INQUIRY-POLICY.md` |
| Admin login | `관리자 로그인` | button locked | inquiry board | list loads | generic credential error or setup error | password on error, board title on success | `docs/INQUIRY-POLICY.md` |
| Read list/detail | route load, refresh, load more, view | reserved list status | same route | count/status | persistent retry; stale request aborted | selected detail close then trigger | `docs/INQUIRY-POLICY.md` |
| Hard-delete | `문의 삭제` then confirm | dialog stays open, duplicate blocked | same list | selected row removed, inline acknowledgement | dialog remains with retry/cancel | next surviving view button or board title | `docs/INQUIRY-POLICY.md` |
| Logout | `로그아웃` | button locked | login view | inline confirmation | board remains with error | password input | `docs/INQUIRY-POLICY.md` |
| Create product | `제품 등록` | fields retained, files upload with progress, duplicate blocked | same admin route with refreshed owning list | persistent list acknowledgement | uploaded result and values retained when safe; retry without duplicate | product list heading | `docs/PRODUCT-CATALOG-POLICY.md` |
| Read product detail | product image/name/`상세 보기` | reserved product loader | `product.html?id=...` | complete product content | app-owned not-found state and products link | product title | `docs/PRODUCT-CATALOG-POLICY.md` |
| Hard-delete product | `삭제` then `제품 삭제` | dialog stays open, duplicate blocked | refreshed product list | persistent deletion acknowledgement | dialog remains; conflict asks for refresh | product list heading | `docs/PRODUCT-CATALOG-POLICY.md` |

## Navigation and responsive behavior

- Route document title policy: `{페이지} — Himawari`; private routes never include names, email, subjects, or message text in the title.
- Public product detail title: `{제품명} — Himawari`; its canonical query contains only the public product ID.
- Route error / 403 behavior: unauthenticated API returns 401 and UI returns to login; configured-but-unauthorized roles do not exist in this version.
- Responsive table strategy: desktop split list/detail; below 900px list and detail stack, table keeps horizontal scrolling rather than hiding columns.
- Truncation/full-value access: subject and email wrap; full message appears as selectable text in the detail surface.
- Focus restoration: detail close returns to the row trigger; deletion success focuses the next surviving row or board title.

## Overlays and feedback

- Dialog primitive: native modal `<dialog>` with app-owned surface and Korean labels
- Destructive confirmation: inquiry and product hard-delete only; object name, irreversible consequence, danger action, Cancel initial focus
- Unsaved product form: app-owned discard dialog for admin navigation or reset; actual tab/window close uses the narrow `beforeunload` lifecycle guard.
- Toast: not used; actionable feedback remains inline and persistent.
- Unsaved changes: public inquiry values remain after request failure; no route guard because the single short form does not save drafts.
- Layer contract: sticky 100, backdrop 500, dialog 600; native dialog top-layer behavior remains authoritative.

## Async and resilience

- Mutation default: pessimistic for create and delete
- Idempotency: public create reuses a client request ID; Blob overwrite is denied and an existing identical pathname is treated as the prior accepted request, so retry does not duplicate the inquiry.
- Offline/read-stale/write behavior: entered public values remain; admin list error offers retry; no queued writes.
- Retry/timeout: public request warns when confirmation is uncertain and reuses the request ID; list retry is manual.
- Session expiry: 8-hour HttpOnly, SameSite=Strict signed session; 401 returns to login without exposing data.
- Stale request handling: admin list uses `AbortController`; duplicate loads and mutations are blocked.
- Delete failure: confirmation dialog remains open with retry and cancel.
- Product image upload: browser-to-Blob direct upload, 15-minute scoped token, 8MB per image, determinate progress and explicit cancellation. Partial uploads are cleaned up when the session remains valid.
- Product catalog writes: conditional ETag write prevents a stale administrator from overwriting a concurrent change. Conflict keeps form or delete context and requests a refresh.

## Validation

- Layer: client validation for humane feedback, server validation as authority
- Timing: submit first, then blur/input for fields already in error
- Policy: `novalidate`, associated inline Korean errors, first-invalid focus, duplicate-submit prevention
- Sensitive values: password never enters route, log, toast, local/session storage, Blob, or response payload.
- Product validation: client and server both require name, model, integer price, tagline, detailed description, at least one product point, SmartStore URL and owned representative image. Server verifies every uploaded Blob before publishing.

## Permission and privacy UI

- Public clients may create only; list, detail and delete require a valid server-verified administrator session.
- UI hiding is not authorization. Every admin API request verifies the signed HttpOnly cookie.
- Public form states that inquiry data is retained until the administrator deletes it and requires consent.
- Admin deletion is irreversible and offers no false Undo.
- Product create/delete/upload APIs require the same signed administrator session. Public product API exposes only catalog fields and never exposes upload request IDs or managed-image metadata.

## Verification

- Required static commands: project audit, anti-pattern grep, `npm test`, JS syntax checks, `designmd lint`
- Browser matrix: narrow phone and desktop; public product list/detail/not-found; product login/create/upload progress/cancel/empty/list/load-more/session expiry/delete cancel/success/failure; inquiry paths; reduced motion
- Accessibility: keyboard-only form/login/detail/delete flow, dialog Escape/cancel, visible focus, associated errors
- CRUD evidence: API unit/integration tests with a mocked private Blob adapter and browser workflow where environment variables are available
- Remaining release risk: Korean operational privacy copy has no documented legal review.

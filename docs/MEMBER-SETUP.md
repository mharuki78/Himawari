# 회원 기능 운영 설정

## 데이터 저장 구조

- Neon Postgres의 `users`, `oauth_accounts`, `member_sessions`, `cart_items`, `wishlist_items`를 사용합니다.
- `npm run db:migrate`는 테이블과 인덱스를 반복 실행해도 안전하게 준비합니다.
- 소셜 로그인 제공자 식별값은 제공자별로 분리합니다. 이메일이 같아도 계정을 자동 병합하지 않습니다.
- 브라우저 쿠키에는 난수 세션 토큰만 두고, 데이터베이스에는 SHA-256 해시만 저장합니다.
- 회원탈퇴는 회원과 연결된 세션·장바구니·관심상품·OAuth 연결을 `ON DELETE CASCADE`로 영구 삭제합니다.

## Vercel 환경 변수

필수:

- `DATABASE_URL` — Neon 연결 시 자동 등록
- `MEMBER_SESSION_SECRET` — 32자 이상의 비공개 난수, Production/Preview/Development에 Secret으로 등록
- `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` — 네이버 로그인 운영 환경
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google 로그인 운영 환경
- `PUBLIC_SITE_URL=https://allaboutbag.com` — 운영 OAuth 콜백의 고정 기준 주소

브라우저로 전달되는 환경 변수에 클라이언트 시크릿이나 세션 비밀키를 넣지 않습니다.

## OAuth 콜백

- 네이버: `https://allaboutbag.com/api/auth/callback/naver`
- Google: `https://allaboutbag.com/api/auth/callback/google`

네이버 앱 검수 전에는 앱 소유자와 등록한 테스터만 로그인할 수 있습니다. Google OAuth 동의 화면이 테스트 모드라면 등록한 테스트 사용자만 로그인할 수 있습니다.

## 운영 확인

1. `GET /api/auth/session` 응답에서 `configured: true`와 제공자 설정 상태를 확인합니다.
2. 네이버·Google 각각 로그인 후 `/account.html`에서 사용자 이름과 관심상품을 확인합니다.
3. 제품을 장바구니와 관심상품에 담고 로그아웃한 뒤, 같은 제공자로 다시 로그인해 복원되는지 확인합니다.
4. 회원탈퇴 확인 문구를 입력해 계정 데이터가 삭제되고 재로그인 시 새 계정으로 시작하는지 확인합니다.

연결된 개발 환경에서 `node --env-file=.env.local scripts/smoke-members.mjs`를 실행하면 임시 테스트 계정으로 장바구니·관심상품·탈퇴를 확인하고 테스트 데이터를 즉시 삭제합니다.

결제 기능은 이 회원 저장 기능과 별개입니다. 네이버페이·카카오페이는 가맹점 계약, 결제 채널 키, 주문·취소·환불 정책, 서버 검증과 웹훅이 준비되기 전에는 노출하지 않습니다.

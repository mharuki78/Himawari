# Himawari

따뜻하고 신뢰감 있는 패션 백팩 브랜드 **Himawari**의 한국어 정적 홈페이지입니다.

## 실행

빌드 과정 없이 `index.html`을 브라우저에서 열면 됩니다. 로컬 서버로 확인하려면 다음 명령을 사용할 수 있습니다.

```bash
python -m http.server 8000
```

그다음 `http://localhost:8000`에 접속하세요.

## 구조

- `index.html` — 홈 화면 콘텐츠와 대표 제품
- `about.html` — 브랜드 대표 이야기
- `products.html` — 전체 제품 목록
- `checkout.html` — 회원·비회원 내부 주문서와 결제 전 주문 예약 접수
- `guest-order.html` — 비회원 주문 조회와 취소·반품 요청
- `account.html` — 관심상품, 주문 내역, 취소·반품 요청과 계정 관리
- `admin/orders.html` — 주문·배송·취소·환불 상태 관리
- `admin/reels.html` — 홈 하단 영상 등록·정렬·공개 관리
- `products.json` — 제품명, 가격, 이미지, 스마트스토어 구매 링크
- `products.js` — JSON을 읽어 홈과 제품 페이지에 카드를 표시
- `stories.js` — `story/posts.json`에서 최신 글을 읽어 홈에 표시
- `styles.css` — 반응형 디자인과 애니메이션
- `script.js` — 모바일 메뉴, 스크롤 노출, 문의 폼 예시 동작
- `story/` — 블로그 목록, 글 상세, 관리 페이지와 글 데이터
- `assets/` — 브랜드 이미지
- `account.html` — 회원 관심상품과 계정 관리
- `privacy.html` — 회원·문의 개인정보 처리 안내
- `api/auth/`, `api/member/` — 네이버·Google OAuth, 회원 세션, 계정별 장바구니와 관심상품 API

## 회원 기능

회원 기능은 Vercel에 연결한 Neon Postgres와 HttpOnly 세션 쿠키를 사용합니다. 환경 변수, OAuth 콜백, 데이터베이스 준비와 운영 확인은 `docs/MEMBER-SETUP.md`를 따르세요.

회원가입 없이도 주문할 수 있으며, 비회원은 주문번호·이메일·전화번호를 모두 확인한 뒤 주문 상태를 조회하거나 취소·반품을 요청할 수 있습니다. 쿠폰은 서버에서 발급하고 주문 한 건에 한 번만 사용할 수 있습니다.

```bash
npm run db:migrate
```

## 제품 추가

`products.json`의 `products` 배열에 아래 형식의 항목을 추가하면 홈과 제품 페이지에 자동으로 반영됩니다. 두 페이지 모두 `featured: true`인 제품 1개를 크게 보여주고, `curatedRank`가 있는 제품을 순서대로 최대 5개까지 표시합니다.

```json
{
  "name": "제품명",
  "price": 76800,
  "tagline": "제품을 사용하는 구체적인 상황 문구",
  "image": "https://이미지-주소",
  "url": "https://스마트스토어-구매-링크"
}
```

대표 제품에는 `featured: true`와 `highlights` 배열을 추가하고, 추천 그리드에 노출할 제품에는 `curatedRank` 숫자를 지정해 주세요.

문의 폼 전송 기능은 실제 서비스에 맞게 연결해 주세요.

## 네이버페이 주문형 검수

연동은 주문등록 v2.1을 사용합니다. 최종 오픈 전에는 `NPAY_PUBLIC_ENABLED=false`로 운영 화면의 버튼을 숨기고, `NPAY_REVIEW_TOKEN`을 포함한 `/npay-review/{token}` 주소에서만 전체 상품의 Sandbox 주문·찜·장바구니를 검수합니다. 상품정보 XML 기본 주소는 `/api/npay/product-info`입니다.

최종 승인 이후 `NPAY_PUBLIC_ENABLED=true`로 변경하고 운영 배포하면 일반 상품·장바구니 화면에 운영용 네이버페이 버튼이 표시됩니다.

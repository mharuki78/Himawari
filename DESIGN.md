---
version: alpha
name: "Himawari"
description: "오래 쓰는 백팩을 위한 클래식 빈티지 브랜드 사이트"
colors:
  cream: "#F4EFE3"
  ink: "#24241F"
  moss: "#304030"
typography:
  display:
    fontFamily: '"Pretendard Variable", Pretendard, "Noto Sans KR", system-ui, sans-serif'
    lineHeight: "0.98"
  body:
    fontFamily: '"Pretendard Variable", Pretendard, "Noto Sans KR", system-ui, sans-serif'
    lineHeight: "1.78"
rounded:
  DEFAULT: "0px"
spacing:
  section-gap: "15vh"
  page-max: "96rem"
components:
  hero:
    backgroundColor: "#24241F"
  button:
    backgroundColor: "#24241F"
  card:
    backgroundColor: "#F4EFE3"
---

# Himawari Design System

## Overview

### Creative North Star

도시의 출근길과 여행 장비 매장을 하나의 한국어 브랜드 편집물로 엮는다. 검정 공지 바와 밝은 상품 내비게이션, 사진과 먹색 카피가 정확히 반으로 나뉘는 캠페인 화면, 촘촘한 제품 그리드가 실제 가방의 기능성과 신뢰를 먼저 보여주는 것이 기준이다.

### Product context and register

- **Audience and primary job:** 20~40대 학생과 직장인이 자신의 하루에 맞는 백팩을 발견하고 스마트스토어로 이동한다.
- **Target market(s) and evidence:** 한국어 콘텐츠와 네이버 스마트스토어를 사용하는 국내 고객.
- **Locale(s) and language policy:** `ko-KR` 단일 언어. 한국어는 어절을 억지로 분리하지 않고 `word-break: keep-all`을 우선한다.
- **Usage scene:** 모바일에서 제품을 빠르게 훑고, 데스크톱에서 큰 사진과 브랜드 이야기를 천천히 읽는다.
- **Register:** 공개 브랜드·콘텐츠 사이트. `story/admin.html`은 기존 관리 도구이며 이 공개 디자인 계약의 대상이 아니다.
- **Memorable signature:** 스크롤 위치에 맞춰 장면이 감기는 제품 영상을 사진 영역과 먹색 카피 영역으로 나눈 캠페인 히어로.
- **Restraint:** 내비게이션과 상품 카드는 촘촘하게, 브랜드 이야기와 글 본문은 넓은 여백으로 유지한다.
- **Anti-references:** 둥근 카드가 반복되는 SaaS 스타일, 그림자와 그라데이션이 많은 쇼핑몰, 여러 포인트색을 섞은 경쾌한 키즈 브랜드.
- **Token ownership/runtime mapping:** `styles.css`가 색상 토큰의 런타임 소유자다. `assets/gear.css`는 그 세 토큰만 소비하는 공개 사이트 레이아웃 테마이며 색상 원시값을 새로 정의하지 않는다. 이 문서는 `--cream`, `--ink`, `--moss`, `--section-space`, `--max-width`의 승인된 값을 기록한다. 기존 선택자를 위한 `--ivory`, `--green`, `--blue`는 세 기본 토큰을 가리키는 호환 별칭이다.

## Colors

색은 사진을 제외하고 세 가지뿐이다. `cream`은 모든 기본 바탕과 카드, `ink`는 본문·선·짙은 섹션, `moss`는 제품 원단에서 추출한 포인트와 포커스 표시, 큐레이션 면에 쓴다. 투명도는 이 세 색의 혼합으로만 만든다. 별도 회색이나 흰색을 추가하지 않는다.

## Typography

큰 제목은 Pretendard Variable의 225~250 굵기와 촘촘한 자간으로 세련되고 가벼운 고딕 인상을 만든다. 본문은 같은 패밀리의 보통 굵기로 읽기 흐름을 안정시킨다. 한 문단은 최대 `40ch`로 제한하고, 영어 라벨은 작은 크기와 넓은 자간으로만 사용한다. 한 화면의 시선을 주도하는 큰 제목은 하나만 둔다.

## Layout

브랜드·콘텐츠 섹션 위아래 여백은 최소 `15vh`, 콘텐츠 최대 폭은 `96rem`이다. 제품 목록과 내비게이션은 더 촘촘하게 구성하고 이야기 본문은 넓은 호흡을 유지한다. 820px 이하에서는 밝은 헤더 아래 먹색 전체 메뉴로 전환하고 520px 이하의 제품 카드는 가로 스크롤로 탐색한다. 글 상세 본문은 `680px` 이내다.

## Elevation & Depth

그림자와 블러는 사용하지 않는다. 깊이는 큰 사진, 어두운 스크림, 크림과 먹색의 면 전환, 1px 헤어라인으로만 만든다. 텍스트가 사진 위에 놓이면 반드시 먹색 기반 스크림을 둔다.

## Shapes

모든 카드와 버튼은 각진 모서리를 사용한다. 제품의 봉제선처럼 1px 직선을 반복하고, 장식적인 캡슐·둥근 배지·유리 효과는 사용하지 않는다.

## Components

### Foundational visual states

기본은 크림 바탕과 먹색 글자다. 호버는 색이나 밑줄만 즉시 바꾸며 이동·확대하지 않는다. 키보드 포커스는 크림 안쪽 선과 이끼색 바깥 선으로 명확하게 표시한다. 로딩 영역은 최종 콘텐츠와 비슷한 최소 높이를 예약한다.

### Buttons and actions

구매 버튼은 먹색 면과 크림 글자를 사용하고 최소 높이 44px을 보장한다. 텍스트 링크는 밑줄 대신 전체 폭의 헤어라인을 사용해 목적지를 명확하게 한다.

연락 채널은 아이콘 없이 채널명·주소·행동 문구를 담은 큼직한 헤어라인 버튼으로 보여준다. 데스크톱과 모바일 모두 이메일, SNS, 스토어의 전체 주소를 생략하지 않는다.

### Navigation and data display

데스크톱은 검정 공지 바 아래 밝은 상품 내비게이션을 두고, 모바일은 가운데 로고와 좌우 메뉴·스토어 행동을 둔다. 모바일 메뉴는 헤더 아래 전체 먹색 면으로 열며 제품과 이야기 목록은 내용 구획을 헤어라인으로 표현한다.

모든 공개 페이지의 푸터에는 이메일과 SNS 링크를 함께 제공한다.

### Forms and overlays

입력 필드는 배경 없이 밑줄만 사용한다. 검증 문구는 해당 필드 가까이에 두고 `aria-invalid`와 연결한다. 텍스트 영역은 크기 조절을 끈다.

장바구니는 결제 기능이 아니라 브라우저에 보관하는 주문 목록이다. `assets/cart.css`의 `--cart-bg`, `--cart-ink`, `--cart-accent`는 각각 `--cream`, `--ink`, `--moss`를 참조하며, 서랍·수량 조절·버튼은 모두 각진 모서리와 헤어라인을 사용한다. 플로팅 버튼은 모바일 메뉴와 겹치지 않도록 우측 하단에 둔다.

### Iconography

별도 아이콘 라이브러리를 쓰지 않는다. 이동 방향을 나타내는 단순 화살표만 텍스트와 함께 사용한다.

### Motion

허용된 모션은 스크롤 리빌, 홈 히어로의 영상 스크럽, 홈 중간 캠페인 영상 한 개다. 리빌은 800ms, 히어로 영상은 사용자의 스크롤 위치만 따라가며 자동 재생하지 않는다. 캠페인 영상은 무음으로 반복하며 사용자가 직접 일시정지할 수 있어야 한다. `prefers-reduced-motion: reduce`에서는 모든 영상을 포스터로 정지해 보여주고 애니메이션, 전환, 부드러운 스크롤을 모두 끈다.

### Content and data visualization

말투는 과장 없이 사람이 설명하듯 쓴다. 제품명·가격·상황 문구는 `products.json`, 이야기 정보는 `story/posts.json`을 단일 출처로 유지한다.

## Do's and Don'ts

- **Do:** 큰 제품 사진과 충분한 빈 공간으로 오래 쓰는 물건의 신뢰감을 보여준다.
- **Do:** 공개 페이지의 대표 비주얼에는 실제 Himawari 제품 연출컷을 사용한다.
- **Do:** 모든 공개 페이지에서 세 색, 고딕 서체, 검정 공지 바, 밝은 내비게이션과 상품 중심의 밀도를 유지한다.
- **Don't:** 실제 제품과 혼동될 수 있는 생성 이미지를 대표 비주얼로 사용하지 않는다.
- **Don't:** 카드가 움직이거나 이미지가 호버에서 확대되는 효과를 추가하지 않는다.
- **Don't:** 세 가지 기본색 밖의 장식색, 둥근 카드, 그림자, 장식용 그라데이션을 추가하지 않는다.

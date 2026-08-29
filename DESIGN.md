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
  page-max: "88rem"
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

오래된 여행 가방 카탈로그를 현대적인 한국어 편집 디자인으로 다시 만든다. 종이 같은 크림 바탕, 먹으로 인쇄한 듯한 얇은 선, 백팩 원단에서 뽑은 짙은 녹색이 한 벌처럼 보이는 것이 기준이다.

### Product context and register

- **Audience and primary job:** 20~40대 학생과 직장인이 자신의 하루에 맞는 백팩을 발견하고 스마트스토어로 이동한다.
- **Target market(s) and evidence:** 한국어 콘텐츠와 네이버 스마트스토어를 사용하는 국내 고객.
- **Locale(s) and language policy:** `ko-KR` 단일 언어. 한국어는 어절을 억지로 분리하지 않고 `word-break: keep-all`을 우선한다.
- **Usage scene:** 모바일에서 제품을 빠르게 훑고, 데스크톱에서 큰 사진과 브랜드 이야기를 천천히 읽는다.
- **Register:** 공개 브랜드·콘텐츠 사이트. `story/admin.html`은 기존 관리 도구이며 이 공개 디자인 계약의 대상이 아니다.
- **Memorable signature:** 스크롤 위치에 맞춰 장면이 감기는 풀스크린 제품 영상과 두 구간으로 이어지는 브랜드 문장.
- **Restraint:** 나머지 화면은 헤어라인, 넓은 여백, 가벼운 고딕 제목으로 조용하게 유지한다.
- **Anti-references:** 둥근 카드가 반복되는 SaaS 스타일, 그림자와 그라데이션이 많은 쇼핑몰, 여러 포인트색을 섞은 경쾌한 키즈 브랜드.
- **Token ownership/runtime mapping:** `styles.css`가 런타임 토큰의 소유자다. 이 문서는 `--cream`, `--ink`, `--moss`, `--section-space`, `--max-width`의 승인된 값을 그대로 기록한다. 기존 선택자를 위한 `--ivory`, `--green`, `--blue`는 세 기본 토큰을 가리키는 호환 별칭이다.

## Colors

색은 사진을 제외하고 세 가지뿐이다. `cream`은 모든 기본 바탕과 카드, `ink`는 본문·선·짙은 섹션, `moss`는 제품 원단에서 추출한 포인트와 포커스 표시, 큐레이션 면에 쓴다. 투명도는 이 세 색의 혼합으로만 만든다. 별도 회색이나 흰색을 추가하지 않는다.

## Typography

큰 제목은 Pretendard Variable의 225~250 굵기와 촘촘한 자간으로 세련되고 가벼운 고딕 인상을 만든다. 본문은 같은 패밀리의 보통 굵기로 읽기 흐름을 안정시킨다. 한 문단은 최대 `40ch`로 제한하고, 영어 라벨은 작은 크기와 넓은 자간으로만 사용한다. 한 화면의 시선을 주도하는 큰 제목은 하나만 둔다.

## Layout

섹션 위아래 여백은 최소 `15vh`, 콘텐츠 최대 폭은 `88rem`이다. 홈 히어로는 `100svh`, 내부 페이지 첫 화면도 넉넉한 세로 호흡을 유지한다. 820px 이하에서는 모바일 메뉴로 전환하고 520px 이하에서 카드와 편집 그리드를 한 열로 쌓는다. 글 상세 본문은 `680px` 이내다.

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

데스크톱 메뉴는 작고 간결하게, 모바일 메뉴는 화면 전체 먹색 면으로 연다. 제품과 이야기 목록은 내용 구획을 헤어라인으로 표현하며 카드 그림자는 금지한다.

모든 공개 페이지의 푸터에는 이메일과 SNS 링크를 함께 제공한다.

### Forms and overlays

입력 필드는 배경 없이 밑줄만 사용한다. 검증 문구는 해당 필드 가까이에 두고 `aria-invalid`와 연결한다. 텍스트 영역은 크기 조절을 끈다.

### Iconography

별도 아이콘 라이브러리를 쓰지 않는다. 이동 방향을 나타내는 단순 화살표만 텍스트와 함께 사용한다.

### Motion

허용된 모션은 스크롤 리빌과 홈 히어로의 영상 스크럽 두 가지다. 리빌은 800ms, 영상은 사용자의 스크롤 위치만 따라가며 자동 재생하지 않는다. `prefers-reduced-motion: reduce`에서는 영상 대신 포스터와 문구를 정적으로 보여주고 애니메이션, 전환, 부드러운 스크롤을 모두 끈다.

### Content and data visualization

말투는 과장 없이 사람이 설명하듯 쓴다. 제품명·가격·상황 문구는 `products.json`, 이야기 정보는 `story/posts.json`을 단일 출처로 유지한다.

## Do's and Don'ts

- **Do:** 큰 제품 사진과 충분한 빈 공간으로 오래 쓰는 물건의 신뢰감을 보여준다.
- **Do:** 공개 페이지의 대표 비주얼에는 실제 Himawari 제품 연출컷을 사용한다.
- **Do:** 모든 공개 페이지에서 세 색, 얇은 고딕, 헤어라인, 15vh 여백을 유지한다.
- **Don't:** 실제 제품과 혼동될 수 있는 생성 이미지를 대표 비주얼로 사용하지 않는다.
- **Don't:** 카드가 움직이거나 이미지가 호버에서 확대되는 효과를 추가하지 않는다.
- **Don't:** 세 가지 기본색 밖의 장식색, 둥근 카드, 그림자, 장식용 그라데이션을 추가하지 않는다.

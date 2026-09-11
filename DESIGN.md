---
version: alpha
name: "Himawari"
description: "세이지 미스트 바탕에 딥 그로브와 옅은 세이지를 얹은 Himawari 백팩 스토어"
colors:
  primary: "#D9E8D3"
  sage-canvas: "#F3F7EF"
  snow: "#FFFFFF"
  ink: "#333333"
  charcoal: "#212121"
  fog: "#D0D5DD"
  slate: "#616C8A"
  slate-border: "#40444E"
  deep-grove: "#4F6B58"
  sage-pop: "#D9E8D3"
  forest-focus: "#3E6B52"
  sage-tint: "#EEF5EA"
  sage-wash: "#F6F9F3"
  sage-mist: "#E3EFE0"
  sage-mid: "#BFD4BA"
  danger: "#9A352F"
typography:
  display:
    fontFamily: '"Manrope", "Pretendard Variable", Pretendard, "Noto Sans KR", system-ui, sans-serif'
    lineHeight: "1.08"
  body:
    fontFamily: '"Manrope", "Pretendard Variable", Pretendard, "Noto Sans KR", system-ui, sans-serif'
    lineHeight: "1.78"
rounded:
  soft: "18px"
  card: "24px"
  pill: "999px"
spacing:
  section-gap: "15vh"
  page-max: "96rem"
components:
  hero:
    backgroundColor: "#4F6B58"
  button:
    backgroundColor: "#D9E8D3"
  card:
    backgroundColor: "#FFFFFF"
---

# Himawari Design System

## Overview

### Creative North Star

세이지 미스트 종이 위에 딥 그로브 잉크와 아주 옅은 세이지 라벨을 얹은 편안한 가방 편집물을 지향한다. 기존의 큰 제품 사진, 캠페인 영상, 촘촘한 제품 그리드와 구매 흐름은 보존하고, 둥근 흰 카드와 부드러운 세이지 오프셋으로 차분하고 안정적인 분위기를 만든다.

### Product context and register

- **Audience and primary job:** 20~40대 학생과 직장인이 자신의 하루에 맞는 백팩을 발견하고 제품별 구조·네이버 기준가·자사몰 가격을 살펴본 뒤 회원가입 없이도 쿠폰을 적용해 자사몰 주문서를 작성한다. 회원은 네이버·Google 간편 로그인으로 장바구니, 관심상품과 주문 내역을 이어서 보며, 단일 관리자는 제품·문의·주문·쿠폰·첫 화면 팝업을 관리한다.
- **Target market(s) and evidence:** 한국어 콘텐츠와 네이버 스마트스토어를 사용하는 국내 고객.
- **Locale(s) and language policy:** `ko-KR` 단일 언어. 한국어는 어절을 억지로 분리하지 않고 `word-break: keep-all`을 우선한다.
- **Usage scene:** 모바일에서 제품을 빠르게 훑고, 데스크톱에서 큰 사진과 브랜드 이야기를 천천히 읽는다.
- **Register:** 공개 브랜드·콘텐츠·제품 상세 페이지는 사진과 큰 문구가 이끄는 브랜드 레지스터다. `admin/inquiries.html`과 `admin/products.html`은 빠른 판독, 상태 명료성, 안전한 변경이 우선인 제품 레지스터로 분리한다. `story/admin.html`은 기존 관리 도구로 별도 유지한다.
- **Memorable signature:** No.1884 블랙 백팩을 멘 직장인의 도심 캠페인 영상과 딥 그로브 카피 면, 그 위에 조용히 놓이는 옅은 세이지 구매 행동의 대비다. 16:9 무음 루프와 절제된 새벽빛 색감으로 출근용 백팩의 성격을 먼저 보여준다.
- **Restraint:** 내비게이션과 상품 카드는 촘촘하게, 브랜드 이야기와 글 본문은 넓은 여백으로 유지한다.
- **Brand mark:** 공식 로고의 형태와 색을 그대로 보존해 고해상도로 리샘플링한 `assets/himawari-logo-hq.png`를 모든 공개 페이지 헤더와 푸터에 사용한다. 밝은 헤더에는 원본 색상을, 어두운 푸터에는 동일 형태의 고대비 단색 처리를 적용하며, 내비게이션을 압도하지 않도록 2026-08-31 표시 크기의 약 60%를 기준으로 한다. 헤더의 로고 상자는 가로 크기를 키우지 않고 `EST.2010` 하단까지 잘리지 않는 세로 여백을 예약한다.
- **Site icon:** 브라우저 탭과 모바일 홈 화면에는 No.1884의 각진 백팩 실루엣을 단순화한 `assets/favicon.png`를 사용한다. 밝은 파스텔 민트 본체, 살구색 앞 포켓, 크림색 부자재와 짙은 청록 윤곽으로 16px에서도 가방 형태와 수납 구획이 먼저 읽히게 하며, 텍스트·워드마크·배경 컨테이너는 넣지 않는다.
- **Editorial image panels:** 홈 소개·저널과 브랜드 인용문·약속처럼 카피가 주도하는 중간 장면에는 서로 다른 실제 제품 사진을 배경으로 사용하고, 딥 그로브 스크림으로 본문 대비를 유지한다. 이야기 글의 대표 이미지는 실제 Himawari 제품 사진을 기준으로 제품의 색상·형태·포켓·부자재를 유지한 편집 장면을 만들 수 있으며, 상품 판매 사진이나 상세 이미지로 오인되지 않게 이야기 영역에만 사용한다.
- **Anti-references:** 회색 일색의 기업형 SaaS, 블러 그림자와 유리 효과가 많은 쇼핑몰, 여러 포인트색을 섞은 키즈 브랜드, 제품 구매 화면에서 사진을 없앤 추상 일러스트 전용 구성.
- **Scope decision:** 참고 가이드의 색·타이포·형태 언어를 채택하되 ‘사진을 사용하지 않는다’와 단순 내비게이션 지침은 판매 제품의 실물 확인과 기존 정보 구조에 맞지 않아 채택하지 않는다. 현재 제품 사진, 섹션 순서, 메뉴, 주문·회원·관리 흐름은 그대로 유지한다.
- **Token ownership/runtime mapping:** 기존 런타임 토큰이 기준인 Model B를 사용한다. `styles.css`가 `sage-canvas`, `deep-grove`, `sage-pop`, `forest-focus`와 표면·반경·그림자 토큰을 소유하고 `--cream`, `--harbor`, `--moss`가 이를 소비하는 의미 별칭이다. 기존 선택자의 `--color-warm-cream`, `--color-deep-harbor`, `--color-sky-*`, `--blue`는 동일한 세이지 토큰을 가리키는 호환 별칭일 뿐 새 파란색을 정의하지 않는다. `assets/gear.css`, `assets/cart.css`, `assets/member.css`, `assets/orders.css`, `assets/scrub.css`, `story/story.css`가 공개 화면에서 소비하고 `admin/admin.css`는 같은 값을 운영 화면용으로 직접 매핑한다. 영구 삭제·오류에만 `--danger: #9A352F`를 사용한다.

## Colors

`sage-canvas`는 페이지 캔버스, `snow`는 카드와 입력 면, `ink`는 본문, `deep-grove`는 넓은 브랜드 섹션과 강한 제목에 사용한다. `sage-pop`은 채도를 낮춘 주요 구매·저장·이동 행동, `forest-focus`는 포커스와 호버, `sage-tint`와 `sage-wash`는 거의 흰색에 가까운 선택·정보 면이다. `fog`는 기본 구분선, `slate`는 보조 문장에 쓴다. 작은 옅은 세이지 버튼은 접근 가능한 대비를 위해 `charcoal` 글자를 사용하며 포레스트 호버에서만 흰 글자로 전환한다. 한 화면의 장식 포인트는 세이지 계열 하나로 제한한다. 관리자 문의함의 `danger`는 복구할 수 없는 삭제와 오류에만 사용하며 브랜드 장식색으로 확장하지 않는다. 네이버 공식 버튼과 픽셀 게임 장면의 제한 팔레트는 각각 외부 브랜드·게임 세계의 예외다.

## Typography

영문과 숫자는 Manrope, 한국어는 Pretendard Variable과 Noto Sans KR 폴백을 사용한다. 큰 제목과 버튼은 700, 본문은 400~500을 기준으로 하며 전역 자간은 `-0.018em`, 큰 제목은 최대 `-0.04em`까지 조인다. 큰 한국어 제목은 조사나 수식어를 홀로 떼지 않고 의미 단위의 `.headline-line`으로 묶으며 작은 화면에서만 자연스럽게 추가 줄바꿈을 허용한다. 대표 제목의 의미 있는 구절은 옅은 세이지로 강조하고 얕은 단색 오프셋을 허용한다. 한 문단은 최대 `40ch`로 제한하고, 영어 라벨은 작은 크기와 넓은 자간으로만 사용한다. 한 화면의 시선을 주도하는 큰 제목은 하나만 둔다.

## Layout

브랜드·콘텐츠 섹션 위아래 여백은 최소 `15vh`, 콘텐츠 최대 폭은 `96rem`이다. 제품 목록과 내비게이션은 더 촘촘하게 구성하고 이야기 본문은 넓은 호흡을 유지한다. 820px 이하에서는 밝은 헤더 아래 딥 그로브 전체 메뉴로 전환하고 520px 이하의 제품 카드는 가로 스크롤로 탐색한다. 글 상세 본문은 `680px` 이내다.

## Elevation & Depth

부드러운 블러 그림자와 유리 효과는 사용하지 않는다. 주요 옅은 세이지 행동은 `rgba(207, 226, 201, .9) 0 7px 0`, 작은 행동은 5px 오프셋을 사용한다. 흰 카드에는 `deep-grove` 10% 농도의 3px 단색 그림자만 허용한다. 나머지 깊이는 큰 사진, 딥 그로브와 세이지 미스트의 면 전환, `fog` 1px 헤어라인으로 만든다. 텍스트가 사진 위에 놓이면 가독성을 위해 딥 그로브 기반 스크림을 허용한다. 배경 사진은 한 페이지 안에서 같은 이미지를 반복하지 않고 제품·사용 장면이 카피의 의미와 맞을 때만 사용한다.

## Shapes

제품·주문·회원·콘텐츠 카드는 24px, 입력과 작은 패널은 18px, 주요 버튼과 배지는 완전한 pill을 사용한다. 제품 상세의 반분 화면은 바깥 모서리만 둥글게 연결하고 내부 접합선은 유지한다. 픽셀 게임 내부의 버튼·대화상자는 도트 세계의 시각 문법을 위해 각진 형태를 유지하되 게임기 외곽과 규칙 패널만 브랜드 반경을 사용한다.

## Components

### Foundational visual states

기본은 아주 옅은 세이지 미스트 바탕, 흰 카드와 잉크색 글자다. 제품 카드는 포인터 호버와 내부 포커스에서 위로 2px 이내 이동하고, 선을 `sage-mid`, 단단한 그림자를 `sage-wash`로 바꿔 선택 가능성을 알린다. 제품 이미지는 확대하지 않는다. 키보드 포커스는 밝은 안쪽 선과 대비가 충분한 `forest-focus` 바깥 선으로 명확하게 표시한다. 로딩 영역은 최종 콘텐츠와 비슷한 최소 높이를 예약한다.

### Buttons and actions

주요 `바로 구매하기`, 주문 완료, 관리자 저장은 옅은 세이지 면과 고대비 차콜 글자, 단단한 5~7px 오프셋을 사용한다. 포레스트 호버에서는 흰 글자를 사용한다. 장바구니 담기와 상세 보기 같은 보조 행동은 딥 그로브 또는 흰 면을 사용하며 모든 행동은 pill과 최소 높이 44px을 보장한다. 바로 구매하기는 `checkout.html?product=...` 내부 주문서로 이동하며, 장바구니의 `장바구니 주문하기`도 같은 주문서로 연결한다. 텍스트 링크는 기존 정보 구조를 유지하되 중요한 전환 행동과 혼동되지 않게 한다.

네이버페이 주문형은 상품 상세와 장바구니에서 네이버가 제공하는 SDK v2.1 템플릿 버튼을 그대로 사용한다. 상품 목록 카드에는 Npay 버튼을 노출하지 않고 실제 상품 상세페이지에서 Npay 구매·네이버쇼핑 찜을 제공하며, 장바구니에는 담긴 상품의 Npay 구매만 제공한다. 모든 영역은 최소 200px 너비와 복수 버튼·혜택 영역을 위한 150px 높이를 예약한다. 최종 오픈 승인 전 검수 링크는 별도 상품목록을 렌더링하지 않고 비공개 세션을 설정한 뒤 동일한 운영 상품 상세 URL과 UI로 이동하며, 이 세션에서만 Sandbox SDK를 사용한다. 자사몰 주문서 행동과 분리해 사용자가 주문 경로를 혼동하지 않게 한다. 네이버 주문 등록 시 브라우저가 전달한 가격·상품명은 신뢰하지 않고 서버의 현재 공개 카탈로그로 다시 조회하며, 배송비는 3,500원이고 같은 배송 그룹의 상품 합계가 100,000원 이상이면 무료다. 인증키는 서버에만 두고 버튼 인증키만 SDK 초기화를 위해 브라우저로 전달한다.

연락의 기본 행동은 사이트 안의 비공개 문의 접수다. 공개 화면에서 이메일 앱을 여는 링크는 제공하지 않으며, 푸터는 `비공개 문의 남기기`와 SNS를 안내한다. Instagram과 YouTube는 각 공식 로고와 채널명을 함께 표시하며, 주요 구매 버튼과 경쟁하지 않는 보조 링크로 유지한다.

### Navigation and data display

제품 가격에는 현재 판매가와 확인된 네이버 할인율만 표시하며 별도의 가격 동일 문구는 반복하지 않는다. 확인된 네이버 할인율은 `sage-tint` 바탕과 딥 그로브 글자의 pill 라벨로 표시한다. 주문 쿠폰은 한 장만 고르는 라디오 카드이며, 관리자 프로모션 화면은 네 종류의 고정 쿠폰에 활성화·최소 주문금액·최대 할인금액·종료 일시를 설정한다. 첫 화면 프로모션은 native `<dialog>`를 사용하고 동일 저장 버전에서 닫은 팝업은 브라우저에 다시 강제로 띄우지 않는다.

No.0422 쿠폰 게임의 공식 이름은 `HIMAWARI BAG QUEST — 0422 등굣길 어드벤처`다. 실제 검정 0422 제품의 둥근 상단·앞포켓·지퍼·키링 실루엣을 보존한 픽셀 캐릭터와, 석재 담장·벽돌 교문·황금빛 가로수가 이어지는 세로형 16비트 학교 등굣길을 사용한다. 게임기 바로 위에는 수집·회피·수납의 세 단계와 점수별 쿠폰 기준을 한눈에 읽는 각진 규칙 패널을 둔다. 게임을 시작하면 모바일과 데스크톱 모두 게임판·HUD·조작·상태 안내를 하나의 `100dvh` 세션에 묶고 문서 위치를 고정해 상하가 잘리거나 단계 전환 중 화면이 튀지 않게 하며, 언제든 시작 화면으로 나갈 수 있는 44px 닫기 버튼을 제공한다. 캐릭터는 화살표·WASD로 상하좌우 이동하고 모바일은 같은 기능의 방향 패드를 쓴다. Space 또는 JUMP 버튼으로 약 0.6초 점프해 위험물을 넘으면 회피 점수를 받고, F/J 또는 SHOT 버튼으로 현재 바라보는 방향에 새총을 발사해 아령을 부수면 파괴 점수를 받는다. 가운데 방향 패드 버튼은 일시정지를 유지한다. 수집 단계와 모은 물건을 수납칸에 넣는 정리 단계를 한 판으로 이어 보여준다. 2단계에서 정답 수납칸을 고르면 해당 물건의 픽셀 실루엣이 선택 위치에서 가방 중앙으로 날아가 작아지고, 가방과 픽셀 불꽃이 짧게 반응한 뒤 정리 완료 상태를 표시한다. 마지막 물건도 이 동작이 끝난 뒤 결과로 전환하며 모션 감소 설정에서는 이동 없이 즉시 처리한다. 낙하 아이템은 `BOOK`, `PC` 같은 문자 타일을 쓰지 않고 책·노트북·물병·필통·아령·잉크병의 픽셀 실루엣과 색으로 구분한다. 플레이 캐릭터는 아이템보다 시야를 과도하게 가리지 않는 약 17cqw 폭으로 표시하되 충돌 범위는 기존의 관대한 판정을 유지한다. 이동 중에는 방향 전환, 보폭에 맞춘 상하 움직임, 기울기, 지면 그림자, 발걸음 픽셀, 미세한 배경 시차를 함께 보여주되 모션 감소 설정에서는 장식 애니메이션을 제거한다. 생명·단계·점수·시간 HUD는 고정폭 숫자와 단단한 픽셀 테두리로 표현하며, 쿠폰 저장·주문서 자동 적용 계약은 기존 흐름을 유지한다. 픽셀 장면 안에서는 브랜드 크림·먹색·짙은 녹색을 주조색으로 유지하고 앤티크 골드·버건디·가을빛을 장면 한정 보조색으로 허용한다.

데스크톱은 딥 그로브 공지 바 아래 밝은 상품 내비게이션을 두고, 여섯 개 메뉴는 흰 면·포그 선·세이지 단색 오프셋을 가진 작은 `luggage tag`형 pill 버튼으로 표현한다. 현재 메뉴는 딥 그로브 면과 세이지 오프셋으로 명확히 구분하되 헤더의 주 구매 행동보다 시각적 우선순위가 높아지지 않게 한다. 모바일은 가운데 로고와 좌우 메뉴·스토어 행동을 두고, 메뉴가 열리면 헤더 아래 전체 딥 그로브 면에서 각 항목을 44px 이상 높이의 둥근 태그형 행 버튼으로 보여준다.

헤더 로고는 내비게이션 높이 안에서 가로형 비례와 하단 설립연도가 온전히 읽혀야 하며, 모바일에서도 메뉴와 스토어 버튼 사이에 최소 여백을 유지한다. 푸터 로고는 어두운 바탕에서 동일한 실루엣을 크림색 단색으로 보여준다. 홈의 마지막 연락 섹션 직전에는 세로형 숏폼 다섯 편을 중앙 스냅 방식의 필름 레일로 배치해 양옆 장면이 다음 탐색 방향을 알려준다. 양옆 영상은 전체 미디어 영역을 직접 눌러 중앙으로 이동·재생할 수 있다.

모든 공개 페이지의 푸터에는 비공개 문의 링크와 SNS 링크를 함께 제공한다. 상호명, 사업자번호, 대표자명, 사업장 소재지와 통신판매번호는 그 아래의 공통 사업자 정보 정의 목록에 표시하며 모바일에서는 항목별 두 열로 재배치해 긴 주소도 온전히 읽히게 한다.

제품 카드는 대표 이미지와 제품명을 통해 `product.html?id=...`의 개별 상세페이지로 이동한다. 같은 모델의 옵션 pill을 선택하면 선택 상태를 글과 체크로 함께 표시하고 카드의 대표 이미지·제품명·소개·가격·재고·관심상품·구매 대상을 해당 제품으로 즉시 전환한다. 이후 이미지나 `상세 보기`를 누르면 선택한 제품의 `product.html?id=...`로 이동하며, 옵션 선택 중에도 버튼 포커스를 유지한다. 상품 목록과 상세페이지는 현재 관리자 카탈로그를 서버에서 먼저 렌더링해 자바스크립트를 실행하지 않는 검색·심사 도구에도 이름, 가격, 이미지와 구매정보가 노출되어야 하며, 클라이언트 렌더링은 회원 장바구니·관심상품 상태를 이어받는다. 상세페이지는 대표 이미지와 구매 결정을 먼저 보여주는 반분 화면, 확인된 상세 설명과 번호가 붙은 제품 포인트, 쿠팡·네이버 상품 정보처럼 상세 이미지를 원본 비율로 잇는 최대 `56rem` 폭의 세로 콘텐츠 레일, 배송·청약철회 안내 순서로 구성한다. 상세 이미지는 카드 비율로 자르거나 이미지 사이에 장식 간격을 넣지 않고 문서 스크롤로 읽는다. 매우 긴 상세 이미지는 관리자 업로드 전에 브라우저에서 최대 다섯 장의 WebP 조각으로 나눠 저장하고, 공개 페이지에서는 지연 디코딩·낮은 fetch priority·콘텐츠 가시성 예약으로 긴 문서의 초기 렌더링을 줄인다. 이미지가 한 장뿐인 기존 제품은 빈 갤러리를 만들지 않는다.

### Forms and overlays

입력 필드는 흰 바탕, `fog` 1px 선, 18px 반경을 사용한다. 검증 문구는 해당 필드 가까이에 두고 `aria-invalid`와 연결한다. 텍스트 영역은 크기 조절을 끈다.

공개 문의 폼은 이름·이메일·제목·내용과 보관 동의를 받는다. 보관 안내는 제출 버튼 바로 앞에 두며, 접수 중에는 버튼 폭을 유지한 채 중복 제출을 막는다. 관리자 문의함은 둥근 흰 면과 `fog` 헤어라인으로 구성하고, 20건 단위의 목록과 선택한 문의 원문을 나란히 보여준다. 관리자 비밀번호는 기본 마스킹하고 표시/숨기기 버튼을 제공한다. 영구 삭제는 `danger` 색의 별도 확인 대화상자에서만 실행한다.

관리자 제품 등록과 수정은 제품명·모델·가격·소개·상세 설명·제품 포인트·스마트스토어 주소·대표 이미지·상세 이미지를 같은 자연 높이 폼으로 다룬다. 목록의 `수정` 버튼은 현재 값을 폼에 불러오고 옅은 세이지 편집 상태를 표시한다. 수정 시 새 파일을 고르지 않은 이미지 영역은 기존 이미지를 유지하며, 새 대표 이미지나 상세 이미지를 선택한 영역만 교체한다. 파일 입력은 운영체제의 선택기를 사용하되 선택 파일의 이름·용량·미리보기를 화면에 보여준다. 대표 이미지는 8MB, 세로 콘텐츠 레일에 쓰는 상세 이미지는 장당 15MB까지 허용하며 브라우저와 서버가 같은 역할별 제한을 적용한다. 저장 중에는 이미지별 실제 업로드 진행률을 표시하고 취소를 제공하며, 작성 중 이동이나 초기화는 앱 소유 확인 대화상자에서 입력 손실을 알린다. 제품 영구 삭제는 문의 삭제와 같은 `danger` 확인 계약을 사용한다.

옵션·재고 편집기는 제품 폼 안의 옅은 세이지 장부 면으로 구성한다. 옵션을 쓰지 않는 제품은 전체 재고를 한 칸에서 관리하고, 옵션을 쓰는 제품은 `옵션값 / 재고 / 삭제`의 반복 행과 명시적인 `옵션 추가` 행동을 사용한다. 옵션 선택은 공개 상세페이지의 native `<select>`가 소유하며 품절값은 선택할 수 없고, 선택 전에는 장바구니·바로 구매·Npay 주문 행동을 진행할 수 없다. 카드의 옵션 상품 구매 행동은 상세페이지의 선택 위치로 이동한다.

장바구니는 결제 전 주문 목록이다. 비회원 목록은 브라우저에 보관하고, 네이버·Google 간편 로그인 후에는 Neon의 회원 계정에 동기화한다. 관심상품도 같은 비회원→회원 병합 흐름을 사용한다. `assets/cart.css`의 `--cart-bg`, `--cart-ink`, `--cart-accent`는 각각 흰 면, 본문 잉크, 옅은 세이지 행동색을 참조하며 회원 대화상자·서랍·수량 조절·버튼은 공통 카드와 pill 형태를 사용한다. 플로팅 버튼은 모바일 메뉴와 겹치지 않도록 우측 하단에 둔다. 주문 문의는 장바구니 내용을 세션 범위로 전달해 비공개 문의 폼에 제목과 본문을 자동으로 채우며, 수신번호 없는 `sms:` 링크를 노출하지 않는다.

회원 메뉴는 데스크톱 헤더에서 스토어 행동 옆, 모바일에서는 전체 메뉴 안에 둔다. 로그인 대화상자는 네이버·Google 제공자 선택, 로그인 상태, 관심상품 수, 로그아웃과 마이페이지 진입을 제공한다. 회원탈퇴는 `회원탈퇴` 확인 문구를 받는 앱 소유 폼에서만 실행하며 간편 로그인 연결, 세션, 계정 장바구니와 관심상품을 영구 삭제한다.

주문서는 가방에 붙는 포장 명세서처럼 큰 주문 제목, 둥근 흰 입력란과 우측의 24px 상품 합계 카드로 구성한다. 회원가입은 선택이며 비회원도 같은 주문서를 작성한다. 비회원에게는 로그인 시 주문 내역을 계정에서 이어 볼 수 있다는 안내만 보조적으로 제공하고 주문 자체를 막지 않는다. 모바일에서는 상품 합계를 먼저 확인한 뒤 배송정보를 입력한다. PG 연결 전 결제 영역은 비활성 결제수단을 가장하지 않고 `결제 대기` 주문의 의미를 문장으로 설명한다. 마이페이지 주문카드는 주문번호·상태·상품·금액을 먼저 보여주고 배송지와 처리 이력은 기본 접힘으로 둔다. 고객의 취소·반품 요청과 관리자의 취소·환불 완료는 앱 소유 확인 대화상자를 사용한다.

관리자 주문 화면은 `admin/admin.css`의 제품 레지스터를 확장하며, 20건 단위 페이지와 상태 필터는 URL에 보존한다. 상태 필터와 상태 변경은 운영체제 팝업이 허용되는 네이티브 `select`를 정식 소유자로 사용한다. 주문 상세는 데스크톱에서 우측 고정 레지스터, 좁은 화면에서 목록 아래 자연 높이 문서 흐름으로 전환한다.

### Iconography

제품 상세의 크기·소재 안내는 흰 면, 최대 1120px 콘텐츠 폭, 큰 제목과 실제 제품 사진을 사용한다. `assets/product-guidance.js`와 `assets/product-guidance.css`가 전체 제품의 공통 소유자다. 확인된 사양만 정의 목록에 표시하고 미등록 항목은 한 개의 네이티브 details로 묶어 문의로 연결한다. 데스크톱의 사진·사양 2열은 700px 이하에서 1열로 바뀐다. 기존 `styles.css`의 snow·cream·ink·harbor·color-fog 토큰을 사용하며 숫자나 수납 가능 여부를 추정하지 않는다.

별도 아이콘 라이브러리를 쓰지 않는다. 이동 방향을 나타내는 단순 화살표만 텍스트와 함께 사용한다.

### Motion

허용된 모션은 스크롤 리빌, 홈 히어로와 중간 캠페인의 무음 반복 영상, 마지막 연락 섹션 직전의 숏폼 필름 레일, 제품 카드의 짧은 오프셋 변화와 No.0422 게임의 아이템 낙하·점프·새총 탄환·아령 파괴다. 히어로는 스크롤 진행도나 동적 뷰포트 높이에 연결하지 않고 자연스러운 문서 흐름을 유지하며, 두 캠페인 영상은 사용자가 직접 일시정지할 수 있어야 한다. 필름 레일은 화면 중앙에 스냅된 한 영상만 소스를 연결해 자동 재생하고, 화면을 벗어나거나 다른 카드가 중앙에 오면 이전 소스를 해제한다. 영상 직접 선택·이전·다음·재생·소리 제어와 좌우 방향키 탐색을 제공한다. 게임은 시작 버튼을 누른 뒤 저작권 외부 음원 없이 Web Audio로 만든 낮은 음량의 8비트 BGM과 수집·점프·발사·파괴 효과음을 재생하고, 명시적인 BGM ON/OFF를 제공한다. 게임을 일시정지하거나 문서가 숨겨지면 음악과 진행을 함께 멈춘다. `prefers-reduced-motion: reduce`에서는 모든 영상을 포스터로 정지하고 게임 아이템을 낙하시키지 않은 채 수집선에 고정해 보여주며, 점프·파괴 판정과 조작은 유지하되 장식 애니메이션·카드 이동·전환·부드러운 스크롤을 모두 끈다.

홈 브랜드 소개의 `Carry study` 카드는 페이지를 열 때 공개 카탈로그의 품절이 아닌 제품 중 하나를 무작위로 표시한다. 같은 탭에서는 직전 제품을 제외하며, 사진 로드가 끝나면 모델명·제품명·상세 링크를 함께 바꾼다. 카탈로그나 사진 로드에 실패하면 기존 정적 카드를 유지한다. 데스크톱에서만 섹션 안의 짧은 범위로 제품 카드가 30px 이내 이동하고, 모바일에서는 문서 흐름 안의 정지 카드로 유지한다. 게임 초대 카드에는 `assets/game-items.css`의 공통 아이템 그림을 재사용해 실제 게임과 같은 노트북·책·물병·연필을 표시한다. 같은 제품을 멘 픽셀 캐릭터와 이 수집품이 화면에 보일 때만 움직여 실제 제품에서 픽셀 세계로 이어지는 한 장면을 만든다. 제품 옵션은 기존 카드 크기를 고정한 채 사진만 짧게 교차 전환하고, 장바구니 담기 성공 시 제품 이미지가 고정 장바구니 버튼으로 이동해 결과를 확인시킨다. 제품 상세의 번호 포인트와 릴스 진행선은 정보를 드러내는 상태 표시이며 결제·Npay 버튼 자체에는 장식 모션을 추가하지 않는다. 이 상호작용은 `transform`과 `opacity`만 사용하고, 화면을 벗어나면 반복 모션을 중지하며, 모션 감소 설정에서는 정지 이미지와 즉시 상태 변경으로 대체한다.

홈 Journal 영역에서는 데스크톱 마우스 위치에 세이지 연필의 흑연 끝을 정확히 맞추고, 연필 몸통은 오른쪽 위를 향하며 이동 방향에 따라 살짝 기울어진다. 빈 영역에서는 연필이 기본 커서를 대신하고, 같은 끝점에서 이어지는 얇은 세이지 선이 약 0.9초 안에 사라진다. 링크 위에서는 기본 커서를 복원하고 연필을 흐리게 하며 선을 지워 글 읽기와 클릭을 방해하지 않는다. 클릭·키보드·스크롤·영역 이탈 시 효과를 지우고 모바일·터치·모션 감소·고대비 환경에서는 표시하지 않는다. 선은 최대 160개 점으로 제한하고, 움직임과 잔상이 끝나면 애니메이션 프레임도 중지한다.

### Content and data visualization

말투는 과장된 명품 수식어보다 형태, 균형, 구조, 소재, 오래 쓰는 완성도를 구체적으로 말한다. 큰 제목은 자연스러운 한국어 의미 단위로 끊고, 확인되지 않은 수제·원산지·성능 주장은 만들지 않는다. 제품 카탈로그가 아직 생성되지 않은 배포는 `products.json`을 초기 출처로 사용하고, 최초 관리자 변경 이후에는 Public Product Blob의 `products/v1/catalog.json`을 런타임 단일 출처로 사용한다. `api/storefront.js`는 같은 단일 출처로 상품 목록과 상세 HTML을 서버 렌더링한다. 주문·배송·청약철회와 이용약관의 운영 기준은 `docs/COMMERCE-POLICY.md`를 따르고 주문 상태·권한·보관 기준은 `docs/ORDER-POLICY.md`를 따른다. 이야기 정보는 `story/posts.json`을 단일 출처로 유지한다.

## Do's and Don'ts

- **Do:** 큰 제품 사진과 충분한 빈 공간으로 오래 쓰는 물건의 신뢰감을 보여준다.
- **Do:** 공개 상품 페이지의 대표 비주얼에는 실제 Himawari 제품 연출컷을 사용하고, 이야기 글의 생성 장면은 실제 제품 사진을 기준으로 제품 외형을 보존한다.
- **Do:** 모든 공개 페이지에서 세이지 미스트 캔버스, 딥 그로브, 옅은 세이지의 역할과 상품 중심의 밀도를 유지한다.
- **Do:** 제품 카드는 24px 반경과 얕은 단색 그림자를, 주요 행동은 연한 파스텔 세이지 pill과 부드러운 오프셋을 사용한다.
- **Don't:** 생성 이미지를 상품 카드·상품 상세의 판매용 대표 사진으로 사용하거나 실제 제품에 없는 기능·구조·인증을 보여주지 않는다.
- **Don't:** 제품 이미지를 호버에서 확대하거나 카드에 큰 이동·회전을 추가하지 않는다.
- **Don't:** 세이지 그린 외의 경쟁 포인트색, 부드러운 블러 그림자, 유리 효과, 장식용 그라데이션을 추가하지 않는다.

### Product purchase clarity (2026-09-10)

상품 상세 첫 화면은 최대 76rem, 정사각형 사진 영역과 26~36px 제품명으로 구성한다. 대표 사진은 10% 여백과 contain으로 전체 형태를 보존하며 긴 상세 설명 이미지에는 적용하지 않는다. 상세 및 고정 구매 버튼은 deep-grove 바탕과 흰 글자로 활성 상태를 명확하게 표시하고, 비활성 상태만 별도로 흐리게 처리한다.

### Fixed purchase controls

하단 구매 바의 옵션은 기존 native select를 재사용하며 운영체제의 선택 팝업을 허용한다. 실제 상품 옵션은 본문과 양방향 동기화하고, 별도 상품으로 등록된 같은 제품군의 색상·구성은 해당 상품으로 이동하며 수량을 전달한다. 기본 수량은 1개, 상한은 기존 주문서와 동일하게 재고 또는 99개다. 수량은 일반 주문서, 장바구니 담기, Npay에 동일하게 전달하고 합계 상품금액을 표시한다. 공식 Npay 버튼 디자인은 변경하지 않는다.

### Purchase methods

주문서 첫 화면에 공식 Npay 버튼과 무통장입금 선택을 표시한다. 무통장입금을 선택하면 기존 배송정보 폼이 열리고 첫 입력에 포커스를 이동한다. 기존 orders.css의 토큰과 820px 단일 열 기준을 유지한다. 계좌 안내는 주문 전과 완료 화면에 동일하게 표시한다.

Fixed purchase bar compact layout: maximum width 580px; desktop uses two rows and mobile three compact rows. General buy and official Npay buttons share a row. Option help remains available to assistive technology; selection and quantity controls retain their labels and keyboard behavior.

Contact channel cards use three equal white cards on desktop and one column on mobile, with platform logos, channel handles, and a clear external-link affordance. Brand colors are limited to platform marks.

Home About section uses a single left reading column (eyebrow, heading, lead, supporting copy), a right-aligned product card, and three principles beneath. Desktop text and product share the same row group. Mobile stacks content with a right-aligned card; the card does not float or rotate in this layout.

Homepage section alignment is owned by assets/home-layout.css, scoped to .home-layout: 1160px content rail, left-aligned section headings, 32–52px heading scale, balanced image/copy columns, contained featured imagery, and compact full product names with existing purchase controls. Campaign, journal, game, reels and inquiry use the same spacing rhythm; mobile stacks columns without removing content or actions.

Contact page layout is scoped in assets/contact-layout.css: a compact left introduction, white right inquiry panel, paired name/email fields on desktop, full-width message and consent, and a single column on mobile. Existing validation and submission behavior remain authoritative.
Contact introduction includes the existing No.1027 campaign photograph beneath its copy, filling the left column with a cropped lifestyle scene and a small model caption. The form retains an opaque white surface.
Game landing layout uses assets/game-layout.css for compact headings, aligned introduction/rules, and a No.0422 product photograph between hero and play sections. Game console internals, controls, timing and coupon behavior stay unchanged.
Journal index uses story/index-layout.css scoped to story-index-page: compact left headings and a 3/2/1-column photographic card grid. Existing post images, full titles, summaries, tags, dates and destination links remain intact; article reading pages are unchanged.

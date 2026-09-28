# Himawari

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

히마와리 코리아 공식 사이트에서 실제 판매 중인 가방을 발견하고 제품 정보와 사용 장면을 살펴볼 수 있다. 기존 제품·구매·브랜드·이야기 기능에 LookBook을 추가한다.

## Operating Context

사용자는 한국어 홈페이지에서 제품을 확인한다. 운영자는 실제 제품 원본을 참조한 AI 착용 연출 사진을 매일 2~3장 생성해 LookBook에 발행하도록 요청했다. 사진마다 다양한 성인 인물과 장소를 사용하고 해당 제품 상세페이지로 연결한다.

## Capabilities and Constraints

- 기존 정적 HTML/CSS/JavaScript와 GitHub 연결 Vercel 배포를 사용한다.
- 실제 카탈로그의 형태·색상·로고·포켓·치수를 확인한다. AI 사진은 연출임을 표시하고 실제 고객 후기나 실측 착용 사진으로 표현하지 않는다.
- 한국 날짜별 중복 발행을 막고 이미지·참조·진행 기록을 보존한다.
- 가격·재고·주문·로그인·결제 설정은 이 작업 범위 밖이다.

## Brand Commitments

Himawari 공식 로고와 기존 한글 문구 ‘고흐의 감성을 담아, 일상에 색을 더하는 히마와리.’를 유지한다. 시각 구현은 기존 DESIGN.md와 실행 중인 사이트를 기준으로 확장한다.

## Evidence on Hand

운영 카탈로그 /api/products, assets/, story/, docs/story-runs/, backups/의 원본과 발행 기록. LookBook의 인물과 장소는 AI 연출이며 고객 경험의 증거가 아니다.

# 구조화 데이터 선택 항목의 근거

2026-10-19 점검. 확인한 사실만 JSON-LD에 추가한다. 경고를 없애기 위한 예상값은 사용하지 않는다.

## 홈페이지

- `OnlineStore.image`: 홈페이지 첫 영상의 실제 포스터인 `assets/hero-9007-poster.jpg`. 원본을 직접 확인했으며 기존 사진을 재사용한다.
- `address.postalCode`: `15010`. [행정안전부 주소정보누리집](https://www.juso.go.kr/)에서 사업장 도로명 주소 `경기도 시흥시 배곧4로 32-29`를 검색해 파크뷰 건물과 우편번호를 확인했다. 오프라인 매장 방문 가능 여부나 영업시간을 추정하지 않는다.

## 이야기의 발행·수정 시각

글별 값과 출처는 [점검 근거 JSON](structured-data-evidence-2026-10-19.json)에 기록한다.

- `publishedAt` 120편: 최초 글 추가 커밋의 RSS `pubDate`를 현재 또는 개편 전 보관 RSS와 대조했다. 기존 발행자가 선언한 시각이며 최초 HTTP 접속 가능 시각으로 주장하지 않는다. 한국 날짜가 원래 발행일과 일치하는 값만 사용했다.
- 나머지 38편: 시각을 확인하지 못했거나, 고정 예약 시각·자정으로 생성된 값 또는 원래 발행일과 모순되는 값이어서 날짜만 유지한다.
- `modifiedAt` 158편: 현재의 완전한 `<article>` 내용과 정확히 일치하는 본문 배포 커밋을 확인하고, Vercel에서 그 운영 배포의 `READY` 시각을 조회했다. 본문 수정본이 운영에 공개된 시각이다. Git 커밋 시각이나 사후 검증 시각을 대신 쓰지 않았다.
- 153편은 10월 16일, 2편은 10월 14일, 3편은 10월 18일 본문 배포에 대응한다. 관련 글 링크의 문구도 본문 변경에 포함하므로 94편의 수정일을 10월 14일에서 16일로 바로잡았다.
- 원래 `date`, URL, 본문, 승인된 사진은 유지한다. 구조화 데이터 편집을 새 일일 발행이나 새 본문 개정으로 세지 않는다.

`story/posts.json`의 선택 필드 `publishedAt`·`modifiedAt`은 근거가 있을 때만 저장한다. `node scripts/update-story-schema.mjs`는 시간대와 한국 날짜의 일치, 발행·수정 순서를 검증하며 시각을 자동 생성하지 않는다. 새 본문을 작성할 때 이전 `modifiedAt`을 제거하고, 새 수정본의 배포 근거를 얻은 뒤 보완한다. 발행일만으로 자정이나 예약 시간을 만들어 넣지 않는다.

## 근거 부족 또는 정책상 추가하지 않는 상품 항목

- `shippingDetails.deliveryTime.transitTime`: 사이트가 고지한 것은 **결제 완료 후 영업일 2일 이내 출고**이다. 이 값은 기존 `handlingTime`으로 유지한다. [로젠택배 공식 FAQ](https://www.ilogen.com/web/customer/faq?gubunCd=DELIVERY&page=1)의 익일 배송은 목표이며 실제 배송 소요일 범위를 보장하지 않는다. 판매자의 확인된 배송 정책 또는 실제 배송 통계 없이 `transitTime`을 추정하지 않는다. [Google의 출고 준비·운송 시간 정의](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)를 구분한다.
- `aggregateRating`·`review`: 점검 당시 공개 리뷰는 쿠팡 628건, 네이버 288건이고 자체 접수된 공개 리뷰는 0건이다. [Google 리뷰 구조화 데이터 지침](https://developers.google.com/search/docs/appearance/structured-data/review-snippet)은 다른 사이트의 후기·평점 집계를 금지하므로 외부 쇼핑몰 후기를 이 사이트의 상품 평점으로 선언하지 않는다. 임의의 평점, 0점, 후기 수를 만들지 않는다.

이 항목의 선택 경고는 유효성 오류와 구분한다. 적합한 근거가 확보되면 해당 상품별로 다시 검증한다.

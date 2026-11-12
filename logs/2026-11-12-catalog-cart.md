# 상품 카드 장바구니 버튼·행사 Npay 원인 확인

- 날짜·작성자·작업 ID: 2026-11-12 Asia/Seoul · Codex · catalog-cart-20261112
- 사용자 요청: 상품 목록의 ‘비교에 추가’를 실제 장바구니 추가로 바꾸고 블랙 프라이데이의 Npay 불가 원인을 확인한다.
- 구현: compact 상품 카드가 기존 createCartButton을 사용한다. 버튼 문구는 ‘장바구니 추가’이며 실제 선택된 SKU·가격·재고를 기존 담기 처리로 넘긴다. 품절은 비활성, 필수 옵션 상품은 ‘옵션 선택 후 담기’로 상세 옵션 선택에 연결한다. 옵션 변경 후 새 footer도 같은 처리를 사용한다. 별도 제품 비교 기능은 유지한다.
- 검증: 기존 비교 동작에서 회귀를 실패시킨 뒤 실제 DOM 카드 함수를 통과시켰다. 전체 테스트395개·독립 검토를 통과했다. Chrome PC1440/모바일390px에서 두 선택 SKU 담기·가격·수량·비교 목록 불변·기존 비교 카드 버튼0개와 같은 줄44px 버튼을 확인했다. 실제 주문·결제·회원 쓰기0개, 브라우저 오류0개이며 새 컨텍스트를 종료했다.
- Npay 진단: 공개 /api/npay/config는 enabled=true, mode=production, review=false였다. assets/npay.js와 assets/checkout.js가 행사 상품을 별도로 차단한다. api/_lib/npay-handlers.js의 validateItems와 api/_lib/npay.js의 productXml은 일반 카탈로그 가격·재고를 사용하며 행사 offer·행사가·한정수량 연동이 없다. 단순 차단 해제는 행사 가격·수량을 보장하지 못한다. 네이버가 모든 행사 상품을 금지한다는 뜻은 아니다. 이번에는 원인을 확인했으며 행사 Npay 연동이나 결제 설정은 변경하지 않았다.
- 공식 자료: https://developers.pay.naver.com/introduce/order 및 https://order-docs.pay.naver.com/docs/ 의 주문등록·상품정보 연동 설명을 대조했다. 실제 결제나 기존 고객·회원 정보 조회는 하지 않았다.
- 완료 근거: backups/catalog-cart-2026-11-12/deployment-receipt.json, production-mobile-card.png, production-asset-hashes.json. 이번 상품 카드 관련 파일만 동기화·배포한다.

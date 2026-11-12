# 장바구니·주문서 편의 기능 진행 기록

- 날짜·작성자·작업 ID: 2026-11-12 Asia/Seoul · Codex · cart-convenience-20261112
- 사용자 확정: 제안한 다섯 가지 모두 적용, 모바일 확인, 동기화·배포.
- 기준: `docs/superpowers/plans/2026-11-12-cart-convenience-spec.md`, 구현 계획은 같은 폴더 `2026-11-12-cart-convenience.md`.
- Ruling: 기존 main 체크아웃과 현재 실행 흐름을 유지한다 — 사용자가 이번 변경의 동기화·배포를 명시했고 기존 작업 파일을 보존해야 한다 — 잘못되면 다른 변경과 섞일 수 있으므로 명시 파일만 stage한다.
- Ruling: cart.source.js에서 기존 esbuild로 classic cart.js를 생성한다 — 공유 배송·혜택·카탈로그 규칙을 재사용하면서 기존 즉시 SiteCart API를 유지한다 — 빌드를 누락하면 소스와 결과가 달라지므로 테스트 전 build:cart를 실행한다.
- Pre-flight: Task1 money/options helpers feed Task2 cart and Task3 checkout; selectedItems feeds Npay only, full items remains member synchronization/order cleanup.
- Ruling: 다섯 기능을 검증한 하나의 기능 커밋으로 배포한다 — 공유 장바구니 번들과 선택·혜택 인터페이스가 함께 동작해야 한다 — 잘못되면 기능 일부만 반영될 수 있으므로 전체 변경 검토와 배포 파일 해시로 확인한다.
- 구현 완료: 공통 배송·혜택 계산, 선택주문·선택삭제·선택 유지, 선택 상품만 전달하는 Npay, 일반·행사 색상/옵션 변경, 모바일 고정 최종금액·구매 방법/주문 동작.
- 독립 검토의 네 지적을 수정했다. 서로 선택 상태가 다른 SKU 병합을 차단하며, 취소·닫기 시 진행 중 옵션 요청과 결과 적용을 취소한다. 옵션 요청·본문 파싱은15초로 제한한다. 주문 요청 실패 후 모바일 버튼 문구·활성을 함께 복구한다. 각 실패를 재현한 회귀 테스트가 통과했고 재검토 승인을 받았다.
- Chrome 미리보기: 실제 공개 상품3개(수량4개) 전체 선택212,800원·혜택127,000원, 행사39,000원 단독 선택+배송3,500원=42,500원·무료배송까지31,000원. 선택 해제·새로고침·선택 삭제, 일반/행사 색상 변경과 원복, 모바일 구매 방법 이동·빈 폼 오류 포커스, 320/390/1440px 가로 넘침 없음·44px 조작 영역을 확인했다. 실제 주문·결제·설정 쓰기 요청0개, 오류0개이며 새 검증 컨텍스트를 종료했다.
- 운영 반영은 아직 확인 전이다. 최종 테스트·배포·운영 화면은 `backups/cart-convenience-2026-11-12/deployment-receipt.json`에 기록한다.

# 2026-11-01 이야기 오전 발행

- 작업 ID: story-2026-11-01-morning / 담당: Codex
- 도착: 2026-10-31T23:01:06.548Z, 한국 시간 2026-11-01 08:01:06.548. 예정 회차: 08:00 이야기. LookBook은 별도 09시 회차다.
- 상태 원본: `docs/story-runs/2026-11-01.json`, 재개 기록: `backups/story-2026-11-01/progress.json`.

기존 173편의 제목·요약·절을 검토하고 전체 본문 검색과 가까운 글의 본문 대조를 거쳤다. 새 주제는 파이핑과 바인딩의 구조, 배색 옵션 이름의 범위, 자동 잠금과 자물쇠 호환의 차이다. 제품은 No.9291 라벤더·No.8029 민트아이보리·No.1111 그린이다. 제품 원본과 치수를 확인했고 미확인 부품 구조·성능은 단정하지 않았다.

본문은 humanize-korean light 경로와 korean-humanizer로 다듬고 독립 finalizer가 검토했다. 변경률은 0.86%, 3.26%, 0.41%이며 의미·수치·서법 검사를 통과했다. 쉼표 구간 길이 통계 경고는 각 게이트 원본에 보존했고 통계만 맞추는 과윤문은 하지 않았다. 각 검수 결과는 `_workspace/2026-11-01-*` 및 backup의 `humanize-runs.json`에서 연결한다.

새 imagegen 사진은 6장이다. 실제 원본 3장과 함께 글마다 3장씩 배치했다. 원본·프롬프트·출력·직접 외형 검수는 backup의 `image-provenance.json`에 있다. AI 장면과 실제 제품 사진의 캡션·대체 텍스트를 구별했다.

첫 작성 전에 HEAD e6bb880de1ce23ea70192aa4aa4cbfc117cfb1ba와 동일한 production READY 원본을 baseline-deployment.json에 보존했다. 첫 배포 전 글은 awaiting-first-deployment이며 날짜만 사용한다. 실제 배포 이력에서 최초 READY를 확인한 뒤 시각과 이력을 기록한다.

준비 검증과 `npm test` 298/298 통과. Chrome156의 1440·390px에서 세 글과 홈·목록, 사진 9장, 실제 제품 링크를 확인했다. 가로 넘침·페이지 예외 없음. 최종 로컬 DOM 근거는 `local-browser-final.json`이며 숨겨진 오류 안내의 h1과 실제 표시된 상품 제목을 구분했다. 로컬 Vercel 분석 스크립트 404는 별도 구분한다. 기존 173편·승인 사진·최초 근거와 사용자 변경을 보존한다.

콘텐츠 커밋 7fb59f49752c4def22508875f426db1ab3b38d8c의 실제 최초 production READY는 1793489328624, 한국 시간 2026-11-01 08:28:48.624다. 원래 baseline READY부터 프로젝트·팀의 production 전체 목록을 조회했고 마지막 pagination에는 next가 없었다. 해당 READY 후보 상세와 Git의 실제 원본 콘텐츠를 대조했다. 최초 배포·이력 원본은 `first-deployment.json` 및 `first-deployment-history.json`에 보존했으며 최초 수정 근거에도 같은 이력을 사용한다. 메타데이터 배포로 최초 시각을 바꾸지 않는다.

최종 운영 배포·PC/모바일·사진·제품 링크·RSS 검증과 완료 여부는 `backups/story-runs/2026-11-01.deployment.json` 및 backup의 `progress.json`과 `published-verification.log`를 따른다. READY 대기나 메타데이터 준비 성공만으로 완료를 판정하지 않는다.

# 2026-11-12 오전 가방 이야기 발행

- 작업ID: story-20261112-morning / 작성자: Codex / 시간대: Asia/Seoul
- 실제 heartbeat 도착: 2026-11-11T22:58:20.630Z (한국 07:58:20). 예정 회차: 2026-11-12 08:00. 예정 시각까지 기다린 뒤 당일 이야기 작업만 시작했다.
- 상태 원본: `docs/story-runs/2026-11-12.json`, 재개 근거: `backups/story-2026-11-12/progress.json`.
- 기준 커밋 `30289cf22c943f5127c7affd8fd179db38a6176d`의 실제 production READY 원본을 새 글 작성 전에 `baseline-deployment.json`에 보존했다.
- 기존 197편 제목·요약·소제목·전체 본문을 저장하고 전수 검색·근접 본문 대조를 수행했다. 중복이 높은 어깨끈·외부 고리·로고 관리 후보를 제외했다. 근거: `topic-review.md`.
- 새 주제: No.1884 블랙의 지퍼 분리/비분리와 몸판 연결, No.1089 핑크의 별도 레인커버 외곽·등판 범위, No.9291 라벤더 두 백팩 사이 접촉과 한 개를 꺼내는 동작. 일반 지퍼 설명은 YKK 자료이며 특정 가방에 해당 제조사 부품이 쓰였다는 뜻이 아니다. Osprey 커버의 표기 예를 No.1089의 권장 규격으로 옮기지 않는다.
- 실제 상품 원본 3장과 해당 공개 사양·치수를 확보했다. 내장 imagegen으로 새 사진 6장을 만들고 원본과 직접 대조했다. 승인 전 No.9291 근접 컷의 불확실한 추가 문자열 한 줄만 수정했다. 승인된 사진은 재생성하지 않았다. 프롬프트·원본·생성 경로·직접 검수: `image-approvals.json`, `image-provenance.json`, `image-correction.json`.
- 글마다 새 생성 사진 2장과 실제 제품 사진 1장을 서로 다른 역할·구도로 배치한다. 사진은 AI 연출과 실제 사진을 캡션·대체 텍스트로 구분하고 WebP로 최적화했다.
- I'm not AI humanize-korean과 korean-humanizer를 함께 적용한 편집·게이트 근거는 `editor-gates.json`에서 관리한다. 상세 초안·최종본·형식·핵심 질문은 같은 backup에 보존한다.

## 완료 판단

준비 검증·관련 전체 테스트·첫 콘텐츠 배포·실제 첫 READY에서 얻은 발행 시각·전체 배포 이력·메타데이터 배포·운영 PC/모바일·사진·제품 링크·홈 최신 이야기·RSS를 확인한 뒤 receipt를 저장한다. `node scripts/verify-daily-story.mjs 2026-11-12 --published` 성공 전에는 완료가 아니다. 최종 결과는 상태 원본의 completionReceipt와 연결된 실제 근거를 따른다. LookBook·상품 가격·재고·주문·로그인·결제 설정은 이 회차 작업 범위에 포함하지 않는다.

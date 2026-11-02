# 2026-11-03 이야기 오전 발행

## 실행과 보존

- heartbeat 실제 도착은 2026-11-03 07:59:26.502 KST, 예정 회차는 같은 날 08:00이다. 작업 시작 시각은 예정 시각 이후였으며 두 시각을 manifest의 trigger에 구분했다. LookBook·주간 리뷰와 과거 미발행일 보충은 실행하지 않는다.
- 작성 전 실제 HEAD `f14fcf7873a6278f69cc7cbb75e8645b38a75018`의 production READY 원본을 `backups/story-2026-11-03/baseline-deployment.json`에 보존했다. baseline에는 오늘의 새 글이 없다.
- 기존 179편과 발행·수정 시각, 승인 사진·배포 근거를 보존한다. 다른 작업의 변경·상거래·인증·결제 설정은 이번 범위에 포함하지 않는다.

## 편집과 사진

- 전체 제목·요약·주요 절과 가장 가까운 글 전문을 비교했다. 새 질문은 생활방수 원단과 완성품의 방수 범위, 개인 소지품과 휴대용 가방의 치수, 재생 소재 표기의 부위·함량이다. 글별 편집 형식과 핵심 질문은 manifest에 기록했다.
- No.1089 핑크, No.0514 실버미니, No.1230 그레이의 현재 제품 원본을 직접 보고 제조사 카탈로그를 근거로 한 공개 치수·소재와 대조했다. Mini와 일반 No.0514 사양을 구별했고 방수 조건·기내 반입 승인·재생 함량·인증을 추정하지 않았다.
- ORTLIEB의 방수 구조 설명, 대한항공의 현재 휴대 수하물 안내, Textile Exchange의 RCS FAQ는 일반 개념이나 해당 항공사 규정의 근거로만 사용한다. 다른 제품 성능이나 인증을 히마와리에 적용하지 않는다.
- 글마다 새 imagegen 연출 2장과 실제 제품 사진 1장을 사용한다. 승인한 생성 사진 6장의 원본·프롬프트·직접 검수와 파일 해시는 당일 manifest 및 `image-provenance.json`에 있다. 원본과 다른 손잡이·로고가 생긴 최초 상세 사진 2장은 제외하고 대체 사진을 검수했다. 공개 사진은 WebP로 최적화하고 AI 연출·실제 사진을 캡션과 대체 텍스트에 구분했다.
- 두 한국어 윤문 지침을 적용하고 독립 monolith 및 finalizer 대조를 마쳤다. 쉼표 간격의 통계 경고는 남았지만 사실·수치·서법 소실과 실제 문장 문제는 없다는 독립 판정으로 수용했다. 원문·윤문·게이트·최종 판정은 당일 backup의 `humanize-1/2/3/`에 보존했다.

## 검증과 배포 단계

- 날짜별 스키마 갱신과 준비 검증을 통과했다. 첫 공개 전에는 `awaiting-first-deployment`로 날짜만 사용하며 실제 시각을 만들지 않는다.
- 구조화 데이터·발행 메타데이터 관련 테스트와 전체 테스트 298개가 통과했다. Chrome 156의 1440px·390px에서 세 글·사진·홈 최신 글·목록을 확인한다. 실제 제품 이동을 포함한 최종 로컬 결과는 `backups/story-2026-11-03/local-browser.json`을 따른다.
- 콘텐츠 커밋 `734374cf2c4946963349426fd3963c12a2d4e986`의 실제 최초 운영 READY는 2026-11-03 08:35:00.366 KST이다. 원래 baseline READY부터 production 배포 이력을 마지막 페이지까지 보존하고 READY 후보 상세·Git 목록과 전체 article을 대조했다. 근거는 당일 `first-deployment.json`, `first-deployment-history.json`, `first-deployment-git-review.json`에 있다. 동일 SHA 재배포도 대조 대상으로 삼았다.
- 실제 최초 READY에서 얻은 `2026-11-02T23:35:00.366Z`를 발행·수정 시각으로 목록·manifest·JSON-LD·RSS에 동기화했다. 최초·수정 배포 근거와 두 이력 필드 및 전체 article 해시를 기록했고 준비 검증의 `metadata: verified`를 확인했다. 후속 메타데이터 READY로 최초 시각을 옮기지 않는다.
- 완료 여부는 manifest의 `completionReceipt`, 당일 `progress.json`, `published-verification.log`를 따른다. 정확한 최종 커밋 READY와 운영 PC·모바일·제품 링크·RSS 확인 및 `--published` 성공 전에는 완료가 아니다.

다른 미완료 업무와 Search Console 색인 상태는 이번 발행으로 검증하지 않았다.

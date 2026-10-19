# 매일 가방 이야기 발행

## 구조화 데이터 유지

새 글 작성·기존 글 편집 후 `node scripts/update-story-schema.mjs --date YYYY-MM-DD`를 실행하고 준비 검증을 진행한다. 날짜는 대상 글의 원래 발행일이다. 이 명령은 그 날짜의 글만 처리하며, 기존 주소·본문·승인된 사진을 유지하면서 BlogPosting에 실제 본문 사진, 발행자·로고, 작성자 링크, 언어와 이야기 목록 연결을 반영한다. 확인된 `publishedAt`·`modifiedAt`이 있으면 JSON-LD에 반영하고 RSS의 해당 항목 `pubDate`를 원래 발행 시각에 맞춘다. 대상 밖 RSS 항목은 변경하지 않는다. 날짜 옵션 없이 실행하면 기존처럼 전체 글의 JSON-LD만 보완한다. `renderRevision` 편집 경로에도 같은 스키마 처리를 적용한다. 페이지에 없는 사진·허위 작성자·확인되지 않은 시각을 추가하지 않는다.

## 2026-10-19 추가: 실제 발행·수정 시각을 완료 조건으로 검사

2026-10-19 이후 새로 발행하는 이야기에는 다음 절차를 적용한다. 과거 글의 미확인 시각을 소급 생성하지 않는다. 예약 시각, 이미지 생성 시각, 초안 저장 시각, Git 커밋 시각, 검증 시각을 실제 발행·수정 시각 대신 넣지 않는다. 자정이나 오전 8시를 일괄 지정하지 않는다.

### 첫 발행

1. 새 글을 추가하기 전 `git rev-parse HEAD`의 실제 40자 커밋을 당일 manifest의 `publicationBaselineCommit`에 기록한다. 그 커밋의 Vercel 운영 READY를 확인하고 원본 응답을 `backups/story-YYYY-MM-DD/baseline-deployment.json`에 보존하며 manifest의 `publicationBaselineEvidence`에 이 경로를 기록한다. 이 기준 커밋에는 당일 새 글이 없어야 하며 READY 확인 후 새 파일을 작성한다. Git 최초 추가 시각은 기준 READY 이후인지 확인하는 용도로만 사용하고 발행 시각으로 대체하지 않는다. 재개 실행에서도 원래 기준 커밋·배포 근거를 보존한다.
2. 글의 원래 한국 발행일은 `story/posts.json`의 `date`에 유지한다. 첫 운영 배포 전에는 시각을 알 수 없으므로 `publishedAt`·`modifiedAt`을 만들지 않는다. manifest의 각 글에 `publicationStatus: "awaiting-first-deployment"`를 기록한다. JSON-LD는 이 단계에서 날짜만 사용하되 BlogPosting·탐색경로·작성자·발행자·로고·실제 본문 사진을 빠짐없이 제공한다.
3. 날짜별 스키마 갱신과 `node scripts/verify-daily-story.mjs YYYY-MM-DD`를 실행한다. 출력 `metadata: "awaiting-first-deployment"`는 첫 배포 전 준비 상태이며 발행 완료가 아니다. 승인된 글·사진을 커밋하고 push한다.
4. **실제 첫 Vercel 운영 공개**를 배포 이력에서 확인한다. Vercel `list_deployments`를 해당 프로젝트·팀, `target=production`, `since=원래 baseline READY epoch`로 조회하고 `pagination.next`가 없거나 null이 될 때까지 페이지를 모두 보존한다(다음 조회의 `until`은 직전 `next`). READY 항목 중 실제 해당 글이 들어 있는 커밋을 Git에서 확인하고 각 후보의 `get_deployment` 원본 응답도 조회한다. 같은 커밋의 재배포를 포함해 READY epoch가 가장 이른 배포를 선택한다. 그 원본 응답을 `backups/story-YYYY-MM-DD/first-deployment.json`에 저장한다. `id`, `state` 또는 `readyState`, `target: "production"`, `meta.githubCommitSha`, 실제 epoch 밀리초 `ready` 또는 `readyAt`을 보존한다. 첫 콘텐츠 배포가 실패하고 수정 커밋이 먼저 성공한 경우도 이력 전체에서 판단한다. 요약 receipt의 `verifiedAt`이나 임의로 만든 READY 시각을 쓰지 않는다.

   공통 `backups/story-YYYY-MM-DD/first-deployment-history.json`은 `{ "since": 실제_baseline_READY_epoch, "pages": [실제_list_deployments_원본_응답들], "details": [후보_get_deployment_원본_응답들] }` 구조로 저장한다. `pages`와 `details` 안의 제공자 필드를 만들어 쓰지 않는다. 마지막 목록의 `pagination.next`가 없거나 null이면 조회가 끝난 것이다. 제공자가 커서를 생략했으면 그대로 보존하고 null 필드를 만들어 넣지 않는다. 각 글의 `publication.firstDeploymentHistoryEvidence`에 이 파일 경로를 기록한다. 재개 시 이 최초 이력·배포를 재사용하며 나중 재배포로 교체하지 않는다.
5. `publishedAt = new Date(firstDeployment.ready).toISOString()`처럼 실제 READY epoch에서 시간대가 있는 ISO 8601 시각을 얻는다(`readyAt`이 실제 필드이면 그 필드를 사용). 새 글의 최초 `modifiedAt`도 같은 시각이다. 이 시각은 본문이 운영에 처음 공개된 시각이며 초안 작성 시각이 아니다. 한국 날짜가 원래 `date`와 다르면 날짜·회차 정합성을 해결할 때까지 완료 처리하지 않는다. 맞추기 위해 시각을 바꾸지 않는다.
6. `story/posts.json`에 `publishedAt`, `modifiedAt`, 한국 날짜의 `dateModified`를 저장한다. 각 manifest 글에는 `publicationStatus: "verified"`와 다음 `publication`을 기록한다. 최초 발행에서는 두 근거 파일 경로가 같고, `articleSha256`은 `scripts/lib/story-publication-metadata.mjs`의 `articleHash(html)`로 구한 완전한 `<article>` 해시이다. `publishedAt`·`modifiedAt`은 목록의 값과 같아야 한다.

```json
{
  "publication": {
    "publishedAt": "실제 첫 운영 배포 READY에서 얻은 ISO 시각",
    "modifiedAt": "실제 본문 배포 READY에서 얻은 ISO 시각",
    "firstDeploymentEvidence": "backups/story-YYYY-MM-DD/first-deployment.json",
    "firstDeploymentHistoryEvidence": "backups/story-YYYY-MM-DD/first-deployment-history.json",
    "modificationDeploymentEvidence": "backups/story-YYYY-MM-DD/first-deployment.json",
    "modificationDeploymentHistoryEvidence": "backups/story-YYYY-MM-DD/first-deployment-history.json",
    "articleSha256": "실제 완전한 article의 SHA-256"
  }
}
```

7. 다시 날짜별 스키마 갱신을 실행해 JSON-LD와 RSS를 맞추고 준비 검증에서 `metadata: "verified"`를 확인한다. 시각을 포함한 목록·페이지·RSS·manifest를 커밋하고 push한다. 이 메타데이터 배포의 READY 시각으로 최초 발행·수정 시각을 다시 덮어쓰지 않는다. 본문·사진을 다시 만들지 않는다.
8. 마지막 메타데이터 커밋의 운영 `READY`, 실제 페이지·이미지·제품 링크, PC·모바일을 확인하고 최종 receipt에 그 커밋과 브라우저 근거를 기록한다. `node scripts/verify-daily-story.mjs YYYY-MM-DD --published`가 성공한 뒤에만 완료로 알린다. 이 명령은 운영 글과 RSS도 직접 요청해 확인한다.

### 본문을 수정할 때

최초 `date`·`publishedAt`·`firstDeploymentEvidence`·`firstDeploymentHistoryEvidence`와 URL·승인 사진을 보존한다. 본문 또는 본문 안 관련 글 링크가 바뀌면 이전 `modifiedAt`과 `publication.modifiedAt`·`modificationDeploymentEvidence`·`modificationDeploymentHistoryEvidence`를 그대로 재사용하지 않는다. 새 수정본 배포 전에는 이를 제거하고 `publicationStatus: "awaiting-content-deployment"`로 기록한다. `dateModified`에는 새 수정본의 한국 날짜만 쓰고 실제 시각은 배포 근거를 얻기 전까지 비운다.

실제 새 본문 배포의 READY 원본 응답을 같은 원래 발행일 backup 아래 별도 파일로 저장한다. 원래 baseline READY부터 수정본 공개까지의 완전한 배포 목록과 후보 상세 응답도 새 이력 파일로 조회·저장하여 `modificationDeploymentHistoryEvidence`에 기록한다. 각 READY 커밋의 완전한 article을 시간 순서대로 비교해 **현재 내용으로 실제 바뀐 배포**를 고른다. 그 뒤 같은 내용을 재배포하거나 메타데이터만 바꾼 배포의 READY 시각으로 수정 시각을 늦추지 않는다. 이전 내용으로 되돌린 경우에는 중간의 다른 내용 배포도 대조하여 실제 되돌린 배포를 수정 근거로 삼는다. 검증기는 이 내용 변화와 수정 배포 시각의 일치도 검사한다.

그 근거로 `modifiedAt`, 한국 날짜의 `dateModified`, 변경된 전체 article 해시와 수정 배포 근거만 갱신한 뒤 `publicationStatus: "verified"`로 바꾸고 스키마·RSS·준비·최종 운영 검증을 진행한다. 기존 글 편집은 새 일일 발행으로 세지 않는다.

### 검증과 재개

준비·완료 검증은 canonical URL·BlogPosting·탐색경로·작성자 URL·발행자 로고·언어·실제 본문 사진 전체를 검사한다. 새 글의 완료 검증은 발행·수정 시각의 시간대, 한국 날짜, 시간 순서, 원본 READY 시각과의 일치, 기준 배포 이후 완전한 이력에서 해당 글의 실제 첫 성공 배포인지, 수정 배포의 완전한 article 내용, 목록·페이지·RSS의 일치를 검사한다. 첫 배포 원본의 목록에는 시각 필드가 아직 없어야 하므로 메타데이터 보완 배포를 첫 배포로 대신 쓸 수 없다. 시각·배포 이력·원본 근거가 빠졌거나 내용이 달라졌으면 실패해야 한다.

중단 후 재개할 때는 이미 기록한 최초 배포와 시각을 사용한다. 빠진 메타데이터·근거·최종 배포·검증만 완료하고 새 글·사진을 중복 생성하지 않는다. 외부 서비스 장애로 READY 근거를 조회하지 못하면 시각 근거 미완료로 보고한다.

관련 회귀 검증: `node --test test/structured-data.test.mjs test/story-publication-metadata.test.mjs`. 전체 작업 후 `npm test`를 실행한다. 과거 시각을 보완한 근거와 미확인 값을 생략하는 기준은 [STRUCTURED-DATA-FACTS.md](STRUCTURED-DATA-FACTS.md)를 참조한다.

## 2026-10-16 사용자 정정: 모든 이야기는 가방이 중심

이야기 전체를 가방 관련 주제로 통일한다. 이전의 '제품·생활을 섞은 매거진'은 가방을 선택하고, 디자인을 살피고, 사용하고 관리하는 내용을 생활 장면과 연결하라는 뜻이다. 도자기·미술 감상·게임 규칙·학습법 등 가방과 무관한 독립 주제를 쓰고 제품 사진이나 마지막 제품 소개만 붙이는 방식은 금지한다. 이 정정은 아래의 넓은 생활·취미 주제 해석보다 우선한다.
제목과 핵심 질문에서 가방의 구체적인 문제가 드러나야 하고 본문의 각 주요 절도 그 문제를 설명해야 한다. 생활·여행·취미는 가방을 비교하거나 다루는 실제 조건으로만 사용한다. 소품 이름만 바꾼 짐 챙기기 글을 반복하지 말고 형태·입구·포켓·손잡이·끈·색·제품 정보·사용 동작처럼 서로 다른 가방 쟁점을 깊게 다룬다. 제품별 구조와 치수·소재·기능은 실제 확인한 근거 안에서만 설명한다. 가방이라는 단어를 늘리는 것으로 주제 검토를 대신하지 않는다.
기존 글의 수정은 기존 주소와 발행일, 승인된 사진을 유지하는 별도 편집 작업이며 새 일일 발행으로 세지 않는다. 긴 본문·다양한 글 형식·여러 사진·AI/실제 사진 구분 기준, 하루 이야기 3편과 LookBook 2장 및 기존 실행 시각은 유지한다. 발행 전에 제목·요약·전체 본문을 읽고 '가방을 제외해도 그대로 성립하는 글인가'를 검토한다. 그렇다면 가방 주제로 다시 작성한다.

## 2026-10-14 사용자 변경: 10월 15일부터 매거진 기준

이 절은 2026-10-15 이후 발행일에 아래의 짧은 글·글당 생성 사진 1장·하루 생성 사진 3장 기준보다 우선한다. 오전 08:00 글 3편, 08:30 누락 복구 일정은 유지한다. 이전 발행 기록은 당시 기준으로 검증하며 이미 승인된 사진은 다시 만들지 않는다.

제품과 생활을 섞은 매거진으로 작성한다. 각 글은 독자가 실제로 궁금해할 한 가지 질문과 분명한 논지를 갖고, 한국어 본문 2,400~4,500자를 목표로 한다(최소 2,400자, HTML·사진 설명 제외). 구체적인 예시, 이유, 상황별 차이, 선택의 장단점을 설명하며 분량을 채우기 위한 반복 문장과 당연한 준비 요령을 넣지 않는다. 제품 기능·수납·효과·제작 과정·고객 경험은 실제 확인된 근거만 쓴다. 외부 치수를 내부 수납 치수로 해석하지 않는다.

최근 제목·요약뿐 아니라 기존 전체 본문의 핵심 질문, 결론, 글의 구조를 비교한다. 장소·소품·모델만 바꾼 같은 글은 새 주제로 인정하지 않는다. 비교형, 해설형, 상황별 선택, 생활 장면, 관찰과 해석을 주제에 맞게 섞고 매일 세 글에 서로 다른 형식을 사용한다. 고정된 네 개의 준비 단계나 두 개의 FAQ를 강제하지 않는다. 제목·요약은 자연스러운 한국어로 해당 글의 구체적인 내용을 전달한다. 필요 없는 FAQ는 생략한다.

글마다 기본 사진 3장 이상을 사용한다: 실제 제품 원본과 확인된 외부 치수를 참조한 새 imagegen 사진 2장(대표 장면과 본문을 설명하는 다른 구도/디테일) + 실제 해당 제품 사진 1장. 세 글에 서로 다른 실제 모델을 사용하며 하루 새 생성 사진은 최소 6장이다. 같은 생성물을 잘라서 두 장으로 세지 않는다. 사진은 관련 문단 사이에 배치하며 각 사진이 무엇을 설명하는지 짧게 쓴다. AI 사진과 실제 제품 사진을 캡션·대체 텍스트로 구분하고 실제 고객 경험으로 표현하지 않는다. 원본과 생성물을 각각 직접 보고 검수한다. 사용자가 승인한 사진은 재생성하지 않는다.

`docs/story-runs/YYYY-MM-DD.json`에는 `expectedCount: 3`, 실제 합계의 `expectedGeneratedImages`와 글마다 `editorialForm`, `coreQuestion`, `images` 배열을 기록한다. 기존 대표 `image` 필드는 유지한다. `images` 각 항목은 `image`(assets/story/...webp), `imageKind`(generated/reference), `reference`(당일 backup 원본), `role`, 실제 사진의 `sourceUrl`, 생성 사진의 `generatedSource`, `prompt`, `fidelityReviewed: true`를 포함한다. 생성 사진 두 장의 역할과 구도가 달라야 한다. 웹 이미지 및 원본·생성 근거 경로를 모두 검증한다.

착용 장면을 주 2~3일 섞는 기준은 유지하되 새 사진 6장 중 적어도 1장을 글의 내용에 맞춰 구성한다. 뒷모습 전신만 고집하지 않고 제품이 명확히 보이는 측면, 손에 들기, 어깨에 걸치기, 활동 장면을 실제 제품 구조에 맞게 활용한다. 기술 검증은 글의 깊이나 문체를 대신하지 않으므로 마지막에 전체 본문과 사진의 관계를 직접 읽어 검토한다.

준비·배포·READY·운영 PC/모바일·홈페이지 최신 이야기·제품 링크·`--published` 완료 조건은 아래와 동일하다. `verify-daily-story.mjs`는 10월 15일부터 본문 길이, 세 사진, 새 생성 사진 두 장 이상과 원본/생성 근거를 검사한다. 새 완료 알림은 글 3개 링크와 이번 생성 사진 수만 간단히 안내한다. 현재 기존 이야기의 전체 개정은 별도 편집 작업이며 새 일일 글로 세지 않는다.

## 2026-10-03 사용자 승인: 10월 7일까지 하루 두 번

이 절이 아래의 평상시 하루 3편·이미지 3장 제한보다 우선한다. 한국 날짜 2026-10-03부터 2026-10-07까지 오전 08:00에 3편, 오후 16:00에 새 글 3편을 추가 발행한다. 하루 총 6편과 새 생성 이미지 6장이다. 08:30과 16:30은 해당 회차 누락 복구만 수행한다. 10월 8일부터는 원래 오전 1회·하루 3편으로 돌아간다. 이미 완료한 오늘 오전 3편도 첫 회차로 인정한다.

오전 글이 있다는 이유로 오후 회차를 생략하지 않는다. 오후 글은 오전 글을 포함한 기존 전체 주제·본문과 비교해 핵심 내용이 겹치지 않게 작성하고, 하루 6편에 서로 다른 6개 제품 모델과 새 이미지 6장을 사용한다. 기존 완료 글과 승인된 이미지는 유지한다. 착용 사진 주 2~3일 기준과 나머지 품질·원본 참조·AI 표시·배포 검증 절차는 동일하다.

오전에는 기존 날짜별 manifest를 유지하고 `expectedCount: 3`을 사용한다(기존 기록의 필드 생략은 3으로 간주). 오후 작업 시작 시 오전 manifest와 완료 receipt를 당일 backup의 `morning/`에 보존한 뒤 같은 날짜 manifest에 `expectedCount: 6`, `expectedGeneratedImages: 6`을 기록한다. 오전 records는 그대로 두고 새 3편만 추가한다. `editions`에 오전·오후의 postIds와 실제 진행 단계를 기록해 보완 실행에서 누락된 회차만 이어 간다. 새 초안·원본·프롬프트·진행 기록은 같은 날짜 backup의 `afternoon/`에 저장한다. 오후 최종 manifest와 receipt는 당일 6편 전체를 기록하고 검증한다. 준비·완료 검증 명령은 그대로 `node scripts/verify-daily-story.mjs YYYY-MM-DD [--published]`이다. 4~5편의 부분 완료나 기간 밖 6편을 완료로 인정하지 않는다.

다른 정상 발행으로 공용 목록·사이트맵이 바뀌어 기존 receipt와 파일이 다르더라도 새 글·이미지 생성 사유로 삼지 않는다. 해당 회차 페이지와 생성물이 존재하는지 먼저 대조하고 현재 운영 READY 커밋과 실제 브라우저 근거를 확인한 경우에만 receipt를 갱신한다. 회차가 완료됐으면 반복 알림을 생략하고, 신규 완료 알림에는 이번에 추가한 글 3개의 링크만 안내한다.

## 착용 이미지 구성 (2026-09-23)

제품 단독 사진만 반복하지 않고 사람이 가방을 메고 있는 착용 연출 컷도 가끔 섞는다. 다음 발행부터 주 2~3일 정도는 그날 새 이미지 3장 중 1장을 글에 맞는 출근·산책·여행 착용 장면으로 구성한다. 최근 기록을 확인해 배경과 구도를 다양하게 한다. 실제 제품 원본과 확인된 치수를 기준으로 형태·로고·색상·포켓 및 사람 대비 비율을 보존한다. 가방이 잘 보이는 뒷모습이나 측면을 활용하고 AI 착용 연출임을 명시한다. 실제 고객 후기나 실측 착용 사진으로 표현하지 않는다. 하루 새 이미지 총 3장 원칙은 유지한다.

## 사용자 지정 실행 모델 (2026-09-17)

매일 정기 블로그 작성·검증·업로드는 실행 시 이 대화에 선택되어 있는 모델로 계속 진행한다. 사용자의 최신 요청에 따라 이전 GPT-5.3-Codex-Spark 전용 실행 및 다른 모델이면 발행 중단 제한은 해제한다. 모델을 임의로 변경하거나 전환 확인을 반복 요청하지 않는다. 토큰 절약을 위해 중복 확인과 출력은 간결하게 하되 기존 발행 품질과 검증 절차는 유지한다.

오전 8시에는 한국 날짜의 글 3편을 발행하고, 8시 30분에는 누락 여부를 확인한다. 보완 확인은 새 글 3편을 더 만드는 작업이 아니다. 모든 실행은 당일 게시물과 기록을 먼저 대조한다.

## 작업 재개 기준

예약 메시지가 활성 작업이면 과거 대화의 제품 수정이나 리뷰 가져오기 완료 메시지로 종료하지 않는다. 대화 요약 이후에도 당일 날짜, 목표 3편, 생성 이미지 3장, 미완료 단계를 먼저 확인한다. `docs/story-runs/YYYY-MM-DD.json`과 `backups/story-YYYY-MM-DD/`의 저장된 이미지·초안을 확인하고 빠진 단계만 진행한다. 이미 생성된 이미지는 다시 생성하지 않는다.

## 완료 조건

1. 기존 글 전체와 당일 글의 주제·핵심 내용 중복을 검토한다.
2. 세 글 각각 서로 다른 실제 제품을 참조한 새 생성 이미지 1장씩, 하루 총 3장을 사용한다. 기존 제품 사진 재사용으로 대체하지 않는다. 원본 경로와 프롬프트를 당일 manifest에 기록한다.
3. 페이지, 글 목록, 메타데이터, 사이트맵을 갱신한다. `node scripts/verify-daily-story.mjs YYYY-MM-DD`가 성공해야 커밋한다.
4. 당일 작업만 Git에 반영하고 연결된 Vercel 운영 배포의 READY 상태와 커밋을 확인한다. 브라우저에서 세 글, 이미지, 홈페이지 최신 이야기와 모바일 화면을 확인한다.
5. `backups/story-runs/YYYY-MM-DD.deployment.json`에 실제 확인 결과를 저장한다. 필드: date, commit(40자), deploymentUrl, state=READY, target=production, verifiedUrls(글 3개), homepageVerified, mobileVerified, verifiedAt. 확인하지 않은 값을 true로 기록하지 않는다.
6. `node scripts/verify-daily-story.mjs YYYY-MM-DD --published`가 성공해야 발행 완료로 보고한다. 이 명령은 정확히 3편, 서로 다른 3개 모델과 이미지, 생성 이미지 3개, 링크, 배포 영수증과 커밋의 파일 일치를 확인한다. 글의 품질이나 브라우저 확인을 대신하지는 않는다.

발행 기록이 없거나 명령이 실패하면 완료가 아니다. 오류를 해결해 이어서 진행하고, 외부 서비스나 인증 문제로 완료할 수 없으면 누락 현황과 원인을 알린다. 이미 성공한 날의 보완 확인에서는 중복 발행이나 반복 완료 알림을 하지 않는다. 예약 환경 자체가 실행되지 않는 경우까지 이 검사로 보장할 수는 없다.

2026-09-11: 오전 예약이 기존 글 검토 후 과거 쿠팡 리뷰 작업의 완료 응답으로 잘못 종료된 사례를 복구하며 이 절차와 검증 명령을 추가했다.

2026-09-21 사용자 변경: 모든 글에 새 생성 사진을 사용한다. 2026-09-20 발행분에도 소급 적용했다. 이전 날짜의 발행 기록에는 당시 기준을 유지한다. 재개 시 이미 생성한 당일 이미지는 유지하고 빠진 이미지만 생성한다.

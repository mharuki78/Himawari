# 백업과 복구 운영

## 데이터베이스

`scripts/database-backup.mjs`는 pg_dump custom archive를 AES-256-GCM으로 암호화합니다. PostgreSQL 서버와 같거나 호환되는 최신 pg_dump/pg_restore/psql을 실행 환경에 설치해야 합니다. 키는 `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`로 생성해 비밀 관리 저장소에 보관하고, 백업과 별도로 보관하세요. 채팅, Git, 작업 로그에 남기지 않습니다.

- 환경: DATABASE_URL, BACKUP_ENCRYPTION_KEY
- 생성: `node scripts/database-backup.mjs backup backups/store-YYYYMMDD.hmwbackup`
- 무결성: `node scripts/database-backup.mjs verify backups/store-YYYYMMDD.hmwbackup`
- 복구 훈련: 운영 DB와 호스트가 다른 격리된 빈 DB/Neon 브랜치를 만들고 RESTORE_DATABASE_URL과 RESTORE_CONFIRM=ISOLATED_EMPTY_DATABASE를 설정한 뒤 `restore`로 실행합니다.

파일 덮어쓰기와 운영 호스트 복구를 거부합니다. 복구는 단일 트랜잭션으로 처리합니다. 복구 후 회원, 주문 항목/이력, 재고 예약, 쿠폰, 문의와 파일 연결을 별도로 검증해야 합니다. 훈련 환경에는 메일/결제 비밀키를 주입하지 않습니다.

**아직 운영 자동 백업과 격리 DB 복구 훈련이 실행된 상태는 아닙니다.** 암호화 키/보관 위치/스케줄을 설정해야 합니다. 장기 보관은 개인정보 보존 기간과 일치시켜 관리합니다.

## 파일 저장소

DB 백업에는 Vercel Blob의 문의 사진, 상품 이미지, 카탈로그, 영상이 포함되지 않습니다. 제품 카탈로그의 기존 버전 스냅샷은 그대로 유지합니다. 전체 복구를 위해 각 Blob 저장소도 별도의 비공개 사본과 경로 목록으로 백업하고 실제 복원 검증을 해야 합니다. DB만 복구하고 전체 사이트 복구라고 표시하지 않습니다.

## 장애 확인

`/api/health`의 상태코드와 관리자 `/admin/operations.html`의 실패 알림/변경 기록을 확인합니다. 운영 주소의 외부 가용성 감시 및 담당자 통보 채널은 별도 설정이 필요합니다.

주문 메일은 동일 알림 ID와 원본 본문으로 재시도합니다. [Resend 공식 중복 방지 문서](https://resend.com/docs/dashboard/emails/idempotency-keys)에 따라 키 유지 시간보다 짧은 23시간 안에서만 자동 재발송 대상이 됩니다. 그 이후 또는 주문 상태 변경 후의 실패는 수동 확인으로 분류합니다. 발송 설정이 없는 상태에서 고객 메일을 테스트 발송하지 않습니다.

## Blob 파일 암호화 백업 도구

- BLOB_BACKUP_SOURCE_TOKEN에 해당 저장소의 토큰을 주입합니다. 문의 저장소는 private, 제품 저장소는 public입니다.
- `node scripts/blob-backup.mjs backup backups/inquiries-YYYYMMDD private`
- `node scripts/blob-backup.mjs verify backups/inquiries-YYYYMMDD private`
- 제품 저장소는 다른 새 폴더와 public 옵션으로 같은 작업을 수행합니다.
- 각 파일과 경로 목록 모두 암호화되며 SHA-256으로 내용을 검증합니다. manifest가 없는 실행은 완료된 백업이 아닙니다. 128MB 초과 미디어는 이 도구에서 실패 처리하므로 별도 스트리밍 백업이 필요합니다.
- 복구 훈련은 다른 빈 저장소의 BLOB_RESTORE_TARGET_TOKEN과 RESTORE_CONFIRM=ISOLATED_EMPTY_STORE를 지정합니다. 원래 토큰/기존 파일 덮어쓰기는 거부합니다. 복구 실패 시 격리 저장소에 일부 파일이 남을 수 있으므로 새 빈 저장소로 재시도합니다.
- 파일별 시점은 달라질 수 있습니다. 운영 복구 시 주문/파일 쓰기를 멈춘 점검 시간에 DB와 파일을 함께 백업합니다. 제품 공개 파일의 호스트는 새 저장소에서 달라지므로 카탈로그 참조 URL을 갱신한 후 검증합니다.

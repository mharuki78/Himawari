# 비공개 문의 게시판 배포 설정

문의 게시판은 Vercel의 비공개 Blob 저장소와 서버 함수 환경 변수를 사용한다. 문의 내용은 자동 만료되지 않으며, 관리자가 삭제할 때까지 보관된다.

## 1. 비공개 Blob 저장소 연결

Vercel 프로젝트의 Storage 메뉴에서 Blob 저장소를 생성하고 **Private** 접근으로 연결한다. 연결이 끝나면 `BLOB_READ_WRITE_TOKEN`이 프로젝트 환경 변수에 자동으로 추가된다.

- 공식 안내: https://vercel.com/docs/vercel-blob/private-storage

## 2. 관리자 비밀번호와 세션 비밀값 생성

프로젝트 루트에서 다음 명령을 실행한다.

```powershell
npm run secrets
```

출력되는 값을 다음처럼 관리한다.

- `ADMIN_PASSWORD`: 관리자만 알고 있는 비밀번호다. Vercel에는 저장하지 않고 비밀번호 관리자에 보관한다.
- `ADMIN_PASSWORD_HASH`: Vercel 환경 변수에 저장한다.
- `ADMIN_SESSION_SECRET`: Vercel 환경 변수에 저장한다.

`ADMIN_PASSWORD_HASH`와 `ADMIN_SESSION_SECRET`은 Production과 필요한 Preview 환경에 각각 설정한다. 실제 비밀번호나 비밀값을 Git에 커밋하면 안 된다.

## 3. 배포 후 확인

1. `/contact.html`에서 테스트 문의를 등록한다.
2. `/admin/inquiries.html`에서 관리자 비밀번호로 로그인한다.
3. 문의가 목록과 상세 화면에 표시되는지 확인한다.
4. 테스트 문의를 삭제하고 목록에서 사라지는지 확인한다.

문의 삭제는 복구할 수 없는 영구 삭제다. 저장·접근·삭제 정책은 `docs/INQUIRY-POLICY.md`를 기준으로 한다.


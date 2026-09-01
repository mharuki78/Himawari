# 제품 카탈로그 배포 설정

제품 관리 기능은 공개 제품 데이터와 이미지를 제공하는 별도의 **Public Vercel Blob** 저장소를 사용한다. 문의 원문을 보관하는 Private Blob과 분리해야 한다.

## 1. Public Blob 저장소 연결

1. Vercel 프로젝트의 Storage 메뉴에서 Blob 저장소를 새로 만든다.
2. 접근 모드는 **Public**으로 선택한다.
3. 발급된 read-write 토큰을 프로젝트 환경 변수 `PRODUCT_BLOB_READ_WRITE_TOKEN`으로 저장한다.
4. Production과 관리자 테스트에 사용하는 Preview 환경에 같은 변수를 설정한다.

- 공식 Blob 안내: https://vercel.com/docs/vercel-blob
- 공식 브라우저 직접 업로드 안내: https://vercel.com/docs/vercel-blob/client-upload

제품 이미지는 브라우저에서 Blob으로 직접 전송되며, 관리자 세션을 확인한 서버가 15분짜리 제한 업로드 토큰을 발급한다.

## 2. 관리자 인증

제품 관리와 문의 관리는 동일한 `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`을 사용한다. 아직 설정하지 않았다면 다음 명령으로 생성한다.

```powershell
npm run secrets
```

## 3. 배포 후 확인

1. `/admin/products.html`에서 로그인한다.
2. 테스트 제품과 대표·상세 이미지를 등록한다.
3. `/products.html`과 생성된 `/product.html?id=...` 상세페이지를 확인한다.
4. 테스트 제품을 삭제하고 목록·상세페이지에서 제거되었는지 확인한다.

제품 삭제 정책은 `docs/PRODUCT-CATALOG-POLICY.md`를 기준으로 한다.


# Himawari

따뜻하고 신뢰감 있는 패션 백팩 브랜드 **Himawari**의 한국어 정적 홈페이지입니다.

## 실행

빌드 과정 없이 `index.html`을 브라우저에서 열면 됩니다. 로컬 서버로 확인하려면 다음 명령을 사용할 수 있습니다.

```bash
python -m http.server 8000
```

그다음 `http://localhost:8000`에 접속하세요.

## 구조

- `index.html` — 홈 화면 콘텐츠와 대표 제품
- `about.html` — 브랜드 대표 이야기
- `products.html` — 전체 제품 목록
- `products.json` — 제품명, 가격, 이미지, 스마트스토어 구매 링크
- `products.js` — JSON을 읽어 홈과 제품 페이지에 카드를 표시
- `styles.css` — 반응형 디자인과 애니메이션
- `script.js` — 모바일 메뉴, 스크롤 노출, 문의 폼 예시 동작
- `assets/` — 브랜드 이미지

## 제품 추가

`products.json`의 `products` 배열에 아래 형식의 항목을 추가하면 홈과 제품 페이지에 자동으로 반영됩니다. 홈에는 배열 앞쪽의 제품 3개가 대표 제품으로 표시됩니다.

```json
{
  "name": "제품명",
  "price": 76800,
  "image": "https://이미지-주소",
  "url": "https://스마트스토어-구매-링크"
}
```

문의 폼 전송 기능은 실제 서비스에 맞게 연결해 주세요.

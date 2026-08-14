# 공용 인프라 프로젝트 이미지

공용 인프라 카드의 캐러셀에 사용할 공개 가능한 화면 이미지를 둔다.

- 권장 형식: WebP, PNG, JPG
- 권장 비율: 16:9
- 권장 크기: 1600×900px 전후
- 파일명 예시: `01-overview.webp`, `02-dashboard.webp`, `03-monitoring.webp`
- API 키, 계정 정보, 실제 이메일·IP·로그처럼 공개하면 안 되는 값은 이미지에서 제거한다.

파일을 추가한 뒤 `src/data/about.ts`의 공용 인프라 `gallery.images`에 경로·대체 텍스트·설명을 등록한다.

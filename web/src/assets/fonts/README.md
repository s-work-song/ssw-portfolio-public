# 로컬 Google Fonts

Noto Sans KR와 JetBrains Mono의 WOFF2 파일 및 CSS를 이 디렉터리에 보관한다.
개발 서버와 빌드는 이 파일만 사용하며 Google Fonts를 요청하지 않는다.
Google이 제공한 `unicode-range`, 가변 굵기, `font-display: swap`을 유지한다.
브라우저는 실제로 사용한 글자 범위에 해당하는 파일만 사이트에서 불러온다.

- `manifest.json`: 원본 CSS·폰트·라이선스 URL, 수집 시각, 파일 크기와 SHA-256.
- `noto-sans-kr/`, `jetbrains-mono/`: 원본 그대로의 WOFF2 파일.
- `*.css`: 원본 CSS의 폰트 URL만 로컬 상대 경로로 바꾼 파일.
- `../../../public/fonts/licenses/`: 배포 결과에도 포함되는 OFL 라이선스 원문.

CSS에서 상대 경로로 참조하므로 Next.js가 폰트를 해시된 정적 자산으로 묶고,
GitHub Pages의 `NEXT_PUBLIC_BASE_PATH`도 적용한다. `next/font/local`에 한글
전체 폰트 하나를 넣는 대신 기존 글자 범위별 분할을 유지한다. 선제 preload는 하지 않는다.

폰트 버전을 의도적으로 갱신할 때만 웹 디렉터리에서 다음 명령을 실행한다.

```bash
node scripts/vendor-google-fonts.mjs --refresh
npm run test:fonts
```

갱신 명령은 네트워크를 사용한다. 일반 `dev`, `build`, `install`에는 연결하지 않는다.
갱신 후 파일·라이선스·manifest 변경을 함께 검토하고 사용하지 않는 이전 파일이 남았는지 확인한다.

이 변경의 대상은 Google Fonts 두 종류다. 기본 본문 글꼴 Pretendard의 기존 jsDelivr
브라우저 로딩 방식은 유지한다.

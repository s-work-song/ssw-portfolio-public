# SSW 포트폴리오 웹

소프트웨어 엔지니어 송상운의 경험과 개발에 대한 관점을 소개하는 공개
포트폴리오의 웹 프런트엔드입니다.

[포트폴리오 바로가기](https://s-work-song.github.io/ssw-portfolio-public/about-me/)

## 주요 화면

- **소개**: 경력과 작업 방식, 공개 프로젝트 개요
- **이력서**: 실무 경험과 기술 역량
- **자기소개서**: 개발·협업에 대한 생각
- **연구 경험**: 성능 최적화와 AI 에이전트 활용 과정
- **SI 활용 단계**: 개인과 팀·조직이 현재의 SI 활용 수준을 다섯 단계에 비추어 살펴보는 페이지
- **기록**: 기술적 성찰과 개인적인 회고
- **포트폴리오 AI**: 공개된 내용을 질문으로 탐색하는 안내 기능

## 기록 조회와 복귀

목록·본문은 같은 탭의 메모리에서 성공 응답을 5분간 재사용합니다. 목록은 검색어·태그·
추천 여부별, 본문은 slug별로 나누며 각각 최근 40개까지만 보관합니다. 같은 요청은
합치고 오류는 저장하지 않습니다. 기한이 지나면 다음 조회에서 갱신하며 주기 조회는 없습니다.
화면의 `새로고침`과 오류 재시도는 두 캐시를 비우고 현재 내용을 다시 가져옵니다.
브라우저 새로고침·새 탭은 별도의 메모리 상태로 시작하며 실제 GET은 `no-store`입니다.

뒤로가기와 목록 버튼은 출발 목록의 검색·필터와 선택 기록을 복원합니다. 카드 배치가 끝난
뒤 450ms 동안 선택한 기록까지 스크롤하며 휠·터치·키보드 조작이나 화면 이탈 시 중단합니다.
사이트의 애니메이션 끄기와 기기의 동작 줄이기 설정에서는 즉시 이동합니다.

## 기록 관계도

기록 화면에서 `목록 / 관계도`를 전환합니다.
`/about-me/log/?layout=map`으로 바로 열 수 있고, 기존 검색·태그·추천 순서를 함께 사용합니다.
React Flow 12.12.0은 관계도 선택 시 지연 로딩합니다. 목록 API의 제목·요약·태그만 이용하며
관계도 때문에 본문이나 추론 API를 추가 호출하지 않습니다.

자동 연결은 드문 공통 태그에 가중치를 주고 제목·요약의 공통 단어를 더해, 각 글의
상위 두 후보를 합친 휴리스틱입니다. 의미 검색이나 작성자가 지정한 관계는 아닙니다.
실선 화살표는 공개 본문의 직접 참조 4개를 확인해 둔 실험용 메타데이터이고,
점선은 자동 연결입니다. 이 네 참조는 본문 변경 시 자동 갱신되지 않습니다.

전체 관계도의 연결선은 카드의 상하좌우 중 적절한 면을 선택하고, 다른 카드에서
10px 여유를 둔 경로로 우회합니다. 선택한 선도 카드 뒤에 유지하며, 선택·확대·축소로
경로를 다시 계산하지 않아 글을 고를 때 선이 움직이지 않습니다.

관계도 안의 `전체 보기 / 태그 보기`로 탐색 방식을 고릅니다. 전체 보기는 글끼리의 연결,
태그 보기는 태그별 기록 수를 먼저 보여주고 태그 선택 시 소속된 글을 펼칩니다.
태그 보기에선 추정 관계를 그리지 않으며, 같은 글이 여러 태그에 포함될 수 있습니다.
검색·추천·상단 태그 필터를 바꿔도 선택한 보기 방식은 유지하고 표시 범위만 갱신합니다.
태그 보기에서 상단 태그를 누르면 해당 태그를 중심으로 소속 기록이 바로 펼쳐집니다.
지도 안의 태그 선택도 상단 필터에 반영하며, `모든 태그로 돌아가기`는 상단 필터까지 해제합니다.
태그가 선택된 동안에는 중복 태그 선택기 대신 선택한 태그와 기록 수를 표시합니다.
관계도 필터 전환은 이전 목록의 페이드를 기다리지 않습니다. 현재 요청의 응답을 받기 전에는
이전 관계도 대신 높이를 유지한 로딩 영역을 보여주며, 취소된 요청의 응답은 반영하지 않습니다.

700px 이하의 새 방문은 태그 보기로 시작합니다. 작은 화면의 태그는 2열 카드,
선택한 태그의 기록은 읽을 수 있는 크기의 목록으로 표시합니다. 전체 지도도 직접 선택할 수 있습니다.
`mapMode`, `mapTag`, `mapPost` 주소 매개변수로 보기 방식·태그·글 선택을 복원합니다.
주소에 지정한 모드가 모바일 기본값보다 우선하며, 현재 필터에 없는 선택은 해제합니다.
확대·이동 위치는 같은 브라우저 탭의 sessionStorage에 최근 12개 장면까지 보관합니다.
같은 데이터와 화면 크기에서 본문을 읽고 뒤로 가거나 새로고침하면 복원합니다.

Escape는 지도에서 선택한 글을 해제합니다. 높이 늘리기는 데스크톱 670px에서 최소 900px,
모바일 전체 지도는 540px에서 780px로 늘립니다. 본문 참조 설명은 선택한 글을 기준으로
`이 글에서 참조한 기록`과 `이 글을 참조하는 기록`을 구분합니다.
`이유`, `경험`, `정리합니다`, `기록합니다` 같은 상투어는 주제 연결 근거에서 제외합니다.

`npm run test:log-map`으로 중복·누락 연결과 결정론적 배치·카드 겹침을 검사합니다.
실제 화면에서 카드 선택, 연결 이유, 읽기 링크, 줌·드래그와 좁은 화면을 추가 확인합니다.
라이선스 고지는 `public/licenses/react-flow-LICENSES.txt`에 둡니다.

## SI 활용 단계 시안

`experiment/ai-workflow`의 `/about-me/ai-workflow/`는 채팅, 읽기 전용 분석,
코드 구현, MCP·플러그인 연동, 여러 에이전트 조율을 구분합니다. 소개 페이지에서는
SI 협업 프로젝트 다음에 요약 카드를 두고 상세 페이지와 단계별 앵커로 연결합니다.
다섯 단계는 SI 활용 수준을 설명하며, 방문자에게 개인 또는 팀·조직이 현재 어느 단계로
작업하고 있는지 묻습니다. 각 단계의 설명과 역할은 개인·조직에 적용할 수 있는 관점으로 작성합니다.
ChatGPT 챗봇부터 에이전트 간 협업을 통한 장기간 세션까지 직접 활용한 경험을 정리한 내용입니다.
각 단계 위에 동일한 이동 메뉴를 두고 현재 단계의 카드·번호와 `현재 단계` 표시를 강조합니다.
메뉴를 누르면 해당 단계의 메뉴와 제목이 함께 보이는 위치로 부드럽게 스크롤합니다.
모션 끄기 또는 시스템의 모션 줄이기를 따르는 설정에서는 즉시 이동합니다.
하단에는 현재 활용 단계를 돌아보는 질문과 다음 탭인 기록(Log)으로 이동하는 안내 카드를 둡니다.
연구 경험의 하단 안내는 SI 활용 단계로 연결해 탭 순서대로 이어집니다.

프로젝트 앞의 안내 카드는 백악관의 지침을 참고해 AI(Artificial Intelligence, 인공지능) 명칭 대신 SI 용어를 사용한다는 설명을
반드시 먼저 배치합니다. 이어서 그 방향에 개인적으로 동의한다는 입장과,
2026년 7월 1일 서비스가 재개된 페이블 5의 사용 경험에서 다양한 주제에 대한 답변 수준을 보며
이미 인류의 평균은 넘어서는 범용 지능 능력을 갖췄다고 해도 되지 않을까 생각했다는 평가를 둡니다.
다음 문단에서 답변이 단순한 다음 토큰 예측의 결과에 불과하더라도 내용의 가치는 실재한다는
개인적인 견해와, 수년 이내에 출력 토큰에 담긴 내용이 초지능 수준의 가치를 보여줄 수 있지 않을까
하는 기대를 이어 씁니다. SI 표기에는 자신이 바라보는 기술의 발전 방향과 개인적인 기대를
미리 반영한 표현의 의미도 있다는 설명으로 마무리합니다.
서비스 재개일은 [Anthropic의 공식 재배포 발표](https://www.anthropic.com/news/redeploying-fable-5)에
따릅니다. 6월 30일은 발표일, 7월 1일은 서비스 재개일이며 개인적인 사용 시작일을 뜻하지 않습니다.
모델별 분류 목록과 분류 기준 연도는 명시하지 않습니다.
배경 로그는 준비 중으로 표시하고,
실제 문서가 생기기 전에는 링크를 만들지 않습니다.

소개(Overview)의 본문·프로젝트·활용 실험 설명과 작업 방식 페이지·탭은 SI 표기로 통일합니다.
안내 제목도 `SI 표기 안내`로 맞춥니다. 오픈웨이트에는 AI·SI를 붙이지 않고
`오픈웨이트 모델`이라고 부릅니다. 실험 도입문은 `오픈웨이트 모델부터 프론티어 SI까지`로 표현합니다.
이미지 생성·분석·ComfyUI 협업 설명에도 SI를 사용합니다. 실제 화면의 `AI 설정`·
`포트폴리오 AI`·`AI 쇼핑 도우미` 명칭과 OpenAI 및 모델·도구 크레딧은 보존합니다.
로그 원문과 챗봇 지식은 별도 검토 대상이며 이 표기 변경에 포함하지 않습니다.

현재 단계별 시각 자료는 설명용 도식이며 실제 작업 캡처가 아님을 표시합니다.
캡처가 제공되면 공개 범위를 확인한 뒤 교체합니다. 이 시안은 비공개 로그 원문,
챗봇 지식이나 백엔드의 페이지 이동 허용 목록을 수정하지 않습니다.

`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/data/aiWorkflow.test.mjs`
명령으로 단계·앵커·탭·요약 배치 계약을 검사합니다.

## 실험 갤러리 미디어

각 분류 안의 실험 선택 카드는 화면 너비에 맞춰 줄바꿈하며, 사진은 기존 좌우 슬라이드로 탐색합니다.

Swiper 미디어 이동, Radix 게임·이미지 팝업과 연구 탭·설정 라디오,
Zod 기록 API 검증을 함께 적용합니다. 아래 절은 각 도입 단계와 비교 기준의 기록입니다.
실험 브랜치는 해당 단계의 스냅샷으로 보존하며, 통합 버전은 `main`과 `dev`에서 관리합니다.
공개 Pages 배포는 `main` 푸시로 진행합니다. 기존 워크플로는 `dev` 푸시도 배포를
실행하므로, 같은 변경의 중복 배포를 피하려면 로컬 통합 후 `main`만 푸시합니다.

### Swiper 전환 실험

`experiment/swiper-media-galleries` 브랜치에서는 [Swiper React](https://swiperjs.com/react)
14.3.0으로 두 미디어 컴포넌트의 이동 엔진만 교체합니다. 의존성은 정확한 버전으로 고정하고
루트 workspace lockfile에 기록합니다. 공개 라이선스 사본은
`public/licenses/swiper-LICENSE.txt`에 둡니다.

- `ProjectMediaCarousel`: 원본 이미지의 `realIndex`를 제목·제작 모델·캡션에 연결하고,
  본문과 확대 팝업을 동기화합니다. 여러 장은 순환하며 한 장에는 탐색 UI를 표시하지 않습니다.
- `ArchiveVideoGallery`: 이미지 다음 영상 순서, 첫·마지막 경계, 첫 오픈 이후 hidden
  플레이어 보관, 활성 영상 재생과 비활성/닫기 pause, 기본 재생 컨트롤을 유지합니다.
- 모듈은 `A11y`만 사용합니다. 전역 Keyboard·Navigation·Pagination과 bundle CSS는 넣지
  않습니다. 사이트 모션 끄기 또는 OS reduced-motion에서는 전환 시간을 0으로 맞춥니다.
- 카테고리·실험 선택, BGM, HTML iframe 작품은 기존 구현을 유지합니다. 핀치는 브라우저에
  맡기고 영상 하단 재생 컨트롤에서 시작한 gesture는 슬라이드로 처리하지 않습니다.

Swiper의 짧은 스와이프 판정은 기존 거리 계산과 완전히 같지는 않습니다. 실제 모바일
다중 터치·핀치는 별도 기기 QA가 필요하며, Node 테스트나 좁은 뷰포트 검사만으로 검증하지 않습니다.

이 실험의 기준점은 도입 전 `main`의 `97bc782`입니다. 과거 구현과 비교할 때는
공개 저장소 루트에서 아래처럼 전환합니다. 소스 브랜치를 바꾼 뒤 개발 화면을 새로고침하고,
정적 `out/`을 제공하고 있었다면 빌드를 다시 해야 합니다.

```bash
git switch --detach 97bc782                   # 도입 전 커스텀 슬라이드 비교
git switch experiment/swiper-media-galleries # Swiper 실험으로 돌아오기
git switch main                              # 현재 통합 버전으로 복귀
```

새 작업으로 변경 사항이 생긴 상태에서는 먼저 그 변경을 보존합니다. 강제 전환이나
`reset --hard`는 사용하지 않습니다.

### Radix 팝업 실험

`05a1ccf`는 Swiper 실험을 포함하는 기준점 머지 커밋입니다.
`experiment/radix-media-dialogs`는 이 기준점에서 만든 1차 Radix 실험 브랜치이며,
이 구현은 후속 도입 결과와 함께 현재 통합 프런트엔드에 포함합니다.

`@radix-ui/react-dialog` 1.1.23을 고정하고, 게임 실행과 이미지 확대를 공유
`MediaDialog`로 연결합니다. 디자인 CSS, Swiper의 현재 이미지·제목·제작 모델 연동,
게임 iframe 경로와 sandbox는 유지합니다. Radix에는 Portal, Escape·바깥 클릭 닫기,
모달 안의 Tab/Shift+Tab 순환과 스크롤 잠금을 맡깁니다. 시작/복귀 포커스 대상과
이미지 드래그 후 250ms·핀치 중 바깥 클릭 억제는 호출부 정책으로 전달합니다.

영상 뷰어는 이번 1차 적용에서 제외합니다. 기존 뷰어는 첫 오픈 후 닫아도 hidden
DOM을 보관합니다. 이 정책을 Dialog의 `forceMount`로 그대로 옮기면 닫힌 Content의
배경 접근성 숨김과 Overlay의 스크롤 잠금이 남을 수 있어, 별도의 수명 설계가 필요합니다.
연구 탭·설정 RadioGroup·채팅 UI도 이번 범위에 포함하지 않습니다.

Radix와 새 런타임 종속성의 라이선스 고지는
`public/licenses/radix-dialog-LICENSES.txt`에 포함합니다.
`npm run test:dialogs`는 바깥 클릭 정책·연결 계약을 검사하며, 실제 포커스·iframe 키 입력과
개발/정적 export 화면 검증은 별도로 수행합니다. iframe 내부 Escape는 부모 문서로
전파되지 않으므로 게임 닫기 버튼도 유지합니다.

Radix 적용 전 상태와 비교할 때는 공개 저장소 루트에서
`git switch experiment/swiper-media-galleries`로 전환합니다. 이 상태에도 Swiper는 남습니다.
도입 전 커스텀 슬라이드까지 비교하려면 `git switch --detach 97bc782`를 사용합니다.
현재 통합 상태로 돌아오려면 `git switch main` 또는 `git switch dev`로 전환합니다.
원래 Radix 실험 구현은
`experiment/radix-media-dialogs`에 보존되어 있습니다.
정적 `out/`은 브랜치 변경만으로 바뀌지 않으므로 다시 빌드해야 합니다.

### Zod 기록 API 실험

`experiment/zod-log-api`는 Swiper·Radix를 통합한 기준점 `8813f3d`에서 시작했습니다.
목록·상세 검증의 도입 결과는 현재 통합 프런트엔드에 포함합니다.
기록 목록(`GET /api/logs`)과 상세(`GET /api/logs/:slug`) 응답만 먼저 검증합니다.
검색·목차·이동·연관 조회의 응답 검증과 채팅 파서는 이번 범위 밖입니다.

`zod` 4.6.5를 직접 의존성으로 고정하고, 브라우저 코드는 `zod/mini`에서 필요한
함수만 import합니다. 일반 Zod의 전체 namespace import는 이 Next.js 빌드에서
추가 압축 JS가 약 89.2 KiB, 개별 함수 import는 약 29.5 KiB였습니다.
동일한 검증 계약을 유지하는 Mini 진입점은 약 15.3 KiB여서 이번 실험에 선택했습니다.

스키마와 추론 타입은 `src/lib/logResponseSchemas.ts`에서 함께 정의합니다.
`src/lib/logApi.ts`의 기존 타입 export와 함수 인자는 유지합니다. API 응답을 받은 뒤
`safeParse`를 한 번 실행하며, 렌더링마다 검증하거나 추가 요청을 보내지 않습니다.
필수 필드 누락·잘못된 자료형·음수/소수 total은 거부합니다. 날짜 형식·정렬 숫자와
빈 태그·요약·본문에는 기존 계약을 넘는 제한을 추가하지 않습니다.
추가 서버 필드는 허용하되 검증 결과에는 선언된 필드만 남깁니다.

HTTP 200이어도 JSON 또는 응답 형식이 잘못되면 기존 `LogApiError`로 변환해
오류 안내와 다시 불러오기 UI로 처리합니다. Zod 필드 진단은 오류의 `cause`에만
보관하며 화면에 응답 원문을 표시하지 않습니다. HTTP 오류·연결 오류·`no-store`와
요청 취소는 유지하고, JSON 본문을 읽는 중의 `AbortError`도 그대로 전달합니다.
이는 데이터 형식 검증이며 HTML 정화나 서버 접근 제어를 대체하지 않습니다.

2026-09-30 동일한 로컬 프로덕션 빌드의 HTML 직접 참조 JS를 파일별 gzip으로
합산한 결과, 기록 목록은 243,005 → 258,698 bytes(+15,693), 상세는
275,478 → 291,153 bytes(+15,675)였습니다. 같은 집계에서 랜딩·소개 JS와 CSS는
변화가 없었습니다. 실제 HTTP 전송량·브라우저 지연 시간 측정은 아니며,
채팅·WebMCP의 지연 로딩 청크는 이 HTML 참조 집계와 별도로 봐야 합니다.

`npm run test:log-api`는 스키마, fetch mock 기반 응답·오류·취소 계약과 버전·라이선스를
검사합니다. 실제 기록 화면과 격리 fixture의 오류·재시도 UI는 별도 브라우저 검증입니다.
공개 MIT 고지는 `public/licenses/zod-LICENSE.txt`에 포함합니다.
Zod 적용 전 코드와 비교할 때는 `git switch experiment/radix-media-dialogs`로 전환합니다.
이 상태에는 Swiper와 Radix 팝업이 남습니다. 현재 통합 상태로 돌아올 때는 `git switch dev`입니다.
미커밋 변경이 있을 때는 브랜치 전환만으로 원복되지 않으며, 정적 export도 다시 빌드해야 합니다.

### Radix 연구 탭·설정 실험

`experiment/radix-tabs-settings`는 Zod까지 통합한 로컬 `dev`의 `11f6ca8`에서 시작합니다.
이 브랜치의 도입 결과도 현재 통합 프런트엔드에 포함합니다.
`@radix-ui/react-tabs` 1.1.21과 `@radix-ui/react-radio-group` 1.4.7을 고정하고,
연구 대분류·성능 세부 탭과 설정의 단일 선택 12개 그룹에 적용합니다.
기존 CSS·표시 순서·설정 setter·저장 방식과 자동 제어 `data-*` 표식은 유지합니다.
스위치 두 개, 고정 패널 너비 슬라이더, 초기화 버튼과 영상 뷰어는 변경하지 않습니다.

연구 탭은 controlled `activationMode="manual"`입니다. Tab으로 그룹에 들어가면
선택된 탭으로 진입하며, 방향키·Home/End는 포커스만 옮깁니다. Enter/Space 또는
클릭으로 내용을 바꿉니다. 기존 URL hash·탭/패널 ID·전환 애니메이션·상세 상태는
기존 viewer가 계속 소유하며, Radix Content로 패널의 마운트 정책을 바꾸지 않습니다.
mousedown/keydown과 뒤따르는 click의 동일 선택 요청은 한 번으로 합칩니다.

설정 RadioGroup은 Tab으로 선택 항목에 진입하고 다음 Tab은 다음 그룹으로 나갑니다.
방향키는 이동한 항목을 선택하고 Space도 선택합니다. Enter는 라디오 선택을 하지 않으며,
Home/End는 포커스만 옮깁니다. 선택은 기존 typed Item `onClick` 한 경로에서 처리합니다.
빠른 keyup이 Radix의 0ms 포커스 이동보다 먼저 처리되면 내부 선택 클릭이 누락될 수 있어,
작은 그룹 래퍼가 해당 입력의 누락 클릭만 보완합니다. 정상 클릭을 먼저 관찰하면
보완하지 않으며, 포인터·다른 키·그룹 밖 이동·unmount에서 대기 요청을 정리합니다.
포커스 계산은 Radix에 맡기고 새 전역 키보드 리스너나 별도의 DOM 래퍼는 넣지 않습니다.
SSR의 숨김 radio input은 레이아웃에 참여하지 않으며, 현재 form 없는 화면에서는
하이드레이션 후 제거됩니다. 모바일 폭 QA는 실제 기기·터치 성능 검증과 구분합니다.

2026-09-30 동일한 로컬 프로덕션 빌드의 HTML 직접 참조 JS를 파일별 gzip으로 합산하면
연구 화면은 263,944 → 273,012 bytes(+9,068, 약 8.9 KiB), 설정 화면은
244,754 → 255,755 bytes(+11,001, 약 10.7 KiB)입니다. 다른 확인 화면의 JS 변화는
랜딩·기록 목록·기록 상세 각각 +125 bytes, 소개 +549 bytes이며 CSS는 모두 같습니다.
실제 HTTP 전송량·클릭 지연·메모리 측정은 아니며 지연 로딩 청크도 별도입니다.

`npm run test:radix-controls`는 탭 요청 중복 정책, 라디오 빠른 keyup 보완·취소 정책,
controlled 값·기존 클릭/ARIA/스타일/제어 표식·버전·라이선스 계약을 검사합니다.
키보드·마우스·새로고침과 좁은 화면 검증은 별도로 수행합니다. 이번 LAN 개발 URL에서는
WebMCP 도구가 노출되지 않았지만, localhost 정적 화면에서는 등록 도구의 실제 연구 탭
이동·설정 반영을 확인했습니다. 공통 실행기·스키마의 CPU mock 검증도 별도로 수행하며,
브라우저 지원 범위를 일반화하거나 실제 모델 추론까지 검증한 것으로 보지 않습니다.
추가 런타임 패키지의 MIT 고지는 `public/licenses/radix-controls-LICENSES.txt`에 둡니다.

탭·설정 적용 전 상태와 비교하려면 공개 저장소 루트에서 `git switch --detach 11f6ca8`로
전환합니다. 이 상태에는 Zod·Swiper·Radix 팝업이 남습니다. 원래 탭·설정 실험은
`experiment/radix-tabs-settings`에 보존합니다. 현재 통합 버전으로 돌아올 때는
`git switch main` 또는 `git switch dev`를 사용합니다. 새 변경이 있으면 먼저 보존하고,
정적 `out/`은 브랜치 변경 뒤 다시 빌드합니다. 원격 푸시·배포는 별도 승인 대상입니다.

실험 분류는 `SVG 제작` 바로 다음에 `WebGL`을 배치하고, 이후 기존 2D·3D 게임·Blender·영상물·ComfyUI 순서를 유지합니다.
WebGL에는 `분해도 도감`, `얼음 동동 라떼`, `전광판 시뮬레이터` 세 샘플을 순서대로 둡니다. 기계 장치의 회전·분해·작동과
얼음·커피·우유의 혼합 및 유리잔 반사 시각효과를 다루며, 확인되지 않은 제작 모델이나 CFD 검증을 주장하지 않습니다.
실행 링크는 `https://pf-samples.sworksong.workers.dev/exploded-atlas/`와
`https://pf-samples.sworksong.workers.dev/iced-latte/`입니다. 실제 실행 JPEG만 소개에 사용하며 원본 HTML·JS·ZIP은 공개 프런트엔드에 복사하지 않습니다.
전광판 시뮬레이터는 문구·연출, 2D·3D 렌더링과 도트 패널·구동·전력 옵션을 조절하는 로컬 브라우저 실험입니다.
실행 링크는 `https://pf-samples.sworksong.workers.dev/dot-board/`이며, 설정은 브라우저 localStorage에 저장합니다.
공유 게시판 기능을 비활성화한 정적 버전을 사용하며 클라우드 공유 게시판이나 실제 회로의 정확성을 검증한 시뮬레이션으로 설명하지 않습니다.
`images/agent-experiments/dot-board/`의 실제 JPEG 두 장만 소개에 사용합니다.
분류 앵커는 `#agent-experiments-webgl`, 작품별 직접 링크는 `#exploded-atlas`, `#iced-latte`, `#dot-board`입니다.
새 분류도 기존 프런트 이동 액션·둘러보기와 앵커를 공유하며, 원격 WebMCP 제어 enum이나 모델 도구는 추가하지 않습니다.

2D 게임 실험은 `Planet Defense`, `물고기 키우기`, `OSCILLO · 2D 리듬게임` 순서입니다.
OSCILLO는 앨범·곡·난이도를 선택하고 4개 레인으로 내려오는 노트를 입력하는 브라우저 리듬게임입니다.
사용자가 확인한 제작 정보는 코드 `Opus 5.5`, 음원 `다양한 모델 혼합`이며 별도 역할로 표시합니다.
`images/agent-experiments/oscillo/`의 실제 곡 선택·플레이 캡처 두 장을 사용하고,
`https://pf-samples.sworksong.workers.dev/rhythm-game-oscillo/`를 직접 실행 링크로 연결합니다.
MP3 프리뷰 9곡은 같은 호스트의 `/rhythm-game-oscillo/previews/`에 있는 콘텐츠 해시 포함 URL로 연결합니다.
공개 프런트엔드의 런타임·테스트는 별도 샘플 저장소나 원본 ZIP에 의존하지 않습니다.
`Opus 5.5`(3곡), `Lyria 3.5`(3곡), `GPT Dots 리메이크`(3곡) 순서로 선택하며 모두 13초입니다.
Lyria의 `After the Great Ascent`를 추가하고 `LOW B GRAVITY`는 갱신된 프리뷰를 사용합니다.
`GPT Dots 리메이크`의 세 번째 `Iron Wall March` 프리뷰는 콘텐츠 해시 `c723ea54155f`의 교체본을 사용합니다. 다른 8곡과 순서·앨범은 유지합니다.
외부 음원 URL에는 GitHub Pages의 `basePath`를 붙이지 않습니다.
단일 플레이어에서 사용자가 재생을 눌러 듣고, 곡을 바꾸면 이전 곡을 멈춘 뒤 처음부터 준비합니다.
다른 실험·분류로 이동하면 재생을 멈추고, 이미지 슬라이드만 바꾸면 음원 재생은 유지합니다.
게임 사이트나 음원을 포트폴리오 안에서 자동 실행하지 않습니다.
기존 게임 모음 플랫폼은 소개 페이지에서 완전히 제외하고, 해당 챗봇·WebMCP 이동 목적지도 제거했습니다.
별도 프로젝트 지식·기록·기존 이미지 파일은 삭제하지 않습니다. 새 OSCILLO 전용 모델 도구는 추가하지 않습니다.

물고기 키우기는 수조·상점 이미지 슬라이더와 하단 설명 사이에 BGM `The Saltwater Hour` 플레이어를 표시합니다.
음원은 `media/agent-experiments/aqua-guardian/the-saltwater-hour.mp3`에 두며,
Gemini를 통해 Lyria 3로 제작한 게임 배경음악입니다. 원본 MP3를 재인코딩 없이 사용합니다.
실험 데이터의 선택적 `audio` 항목으로 이미지 슬라이더와 독립적으로 재생하며,
이미지를 넘겨도 음악은 유지합니다. 자동 재생하지 않고, 다른 실험이나 분류로 이동하면 재생을 멈춥니다.

3D 게임 실험은 비행 시뮬레이터, 공성전, `손 관절 리깅 실험`, `1인칭 손·검 훈련장`, `현대전 샘플`, `노을서킷 · 3D 레이싱 게임` 순서입니다.
세 번째 항목은 외부 3D 모델 없이 손·팔 메시와 관절, 스키닝 가중치를 코드로 구성한 리깅 실험입니다.
자세·애니메이션, 손끝 IK, 파지·타격과 가중치 시각화를 실험하며, 같은 리그의 1인칭 화면도 제공합니다.
제작 모델은 Fable 5·Opus 5·GPT-5.6 Sol이고, `images/agent-experiments/hand-joint-rigging/`의 실제 로컬 캡처 세 장을
손 클로즈업, 삼각형 메시 와이어프레임, 손끝 IK 순서로 표시합니다. 별도 공개 데모
`https://ssw-hand-joint-rigging.swsongab11572.chatgpt.site`를 직접 실행 링크로 연결합니다.
키보드·마우스를 사용하는 데스크톱 실험이며, 정밀 인체 시뮬레이션이나 모바일 조작 지원으로 서술하지 않습니다.
네 번째 항목은 자체 제작 손·검 모델과 손가락 리깅·스키닝, 1인칭 조작과 더미 타격을 시험하는
프로토타입이며, 제작 모델은 GPT-5.6 Sol·GPT-6.1 Sol입니다.
`images/agent-experiments/first-person-hand-sword/`의 대표 훈련장·손 관절 캡처 두 장을
재인코딩 없이 표시합니다. 보존용 Polyfork 버전이 아닌 `hand-test-handmade`의 실제 로컬 실행 화면이며,
공개 데모 `https://ssw-hand-sword-training.swsongab11572.chatgpt.site`를 직접 실행 링크로 연결합니다.
훈련장 프로젝트 소스·의존성·빌드 산출물은 포트폴리오의 공개 폴더에 복사하지 않습니다.
일반 Chrome·Edge의 마우스 잠금과 모든 기기의 동작을 검증한 것으로 서술하지 않습니다.

다섯 번째 `현대전 샘플`은 지상·항공 장비의 주행·조준·발포와 아케이드 비행을 확인하는 브라우저 샘플입니다.
제작 모델은 Opus 5.5이며, 모델링 도구 Blender를 보조적으로 활용했습니다.
`images/agent-experiments/modern-warfare-sample/`의 전차 사격장·전투기 활주로
실제 실행 캡처 두 장을 표시합니다. 사용자 지정 주소 `https://modern-warfare-sample.sworksong.workers.dev/`를
직접 실행 링크로 유지합니다. 정밀 군사 시뮬레이션이나 실제 전투 재현으로 서술하지 않습니다.

여섯 번째 `노을서킷 · 3D 레이싱 게임`은 트랙·차량을 선택하고 스피드전·아이템전으로 달리는 브라우저 게임입니다.
`https://pf-samples.sworksong.workers.dev/racing-game-noeul-circuit/`로 연결하며,
`images/agent-experiments/noeul-circuit/`의 실제 레이스 준비·주행 JPEG 두 장을 사용합니다.
제작 모델과 트랙·차량의 수량은 미확인 정보를 채우지 않고, 원본 HTML·JS·ZIP은 공개 프런트엔드에 복사하지 않습니다.
기존 3D 게임 분류와 `#noeul-circuit` 작품 앵커를 사용하며 새 분류·원격 도구·둘러보기 단계를 추가하지 않습니다.

SVG 탭에는 일러스트 항목과 자전거 타는 펠리컨 애니메이션 항목을 둡니다.
펠리컨 비교는 동일한 프롬프트를 각 모델에 단 한 번씩 입력해 얻은 결과를 사용합니다.
펠리컨 항목은 `images/agent-experiments/svg/pelican/`에 Fable 5.1·Opus 5.5·
Sonnet 5.5의 SVG를 연결했습니다. 그 아래에는 GPT-6 Astra·Sol·Luna의 SVG를
같은 3열 그리드에 연결했습니다. 세 번째 행은 Gemini·Grok으로 표시하고,
Gemini 4 Argon·Gemini 3.8 Flash·Grok 4.7 순서로 SVG를 같은 폴더에 연결해 9개 결과를 표시합니다.
Gemini 4 Argon은 제공받은 HTML에서 SVG만 추출했으며, 도형·애니메이션은 수정하지 않습니다.
실제 공통 프롬프트는 `prompt` 필드에 원문 그대로 저장하고,
설명 아래의 별도 「공통 프롬프트」 인용 박스로 표시합니다.

> 자전거 타는 펠리컨을 재생되는 svg로 그려봐 모델 테스트니까 서브에이전트 쓰지말고 직접해

Blender의 중세 무기 항목에는 캡처 다섯 장, 음식·가전에는 가전 세 장과
도넛·와플·마카롱 세 장, 지하철에는 이미지 세 장, 도시 거리에는 렌더 여섯 장을 표시합니다. 가전은 GPT-6 Astra,
음식은 도넛 GPT-6 Astra·와플 Grok 4.6·마카롱 Opus 5.5로 항목별 제작 모델을 표시합니다.
음식·가전의 사진별 `title`과 `modelCreditPurpose`를 기존 `modelCredits`에 연결해,
슬라이드 전환 시 상단 헤더에는 현재 작품명과 제작 모델만 표시합니다.
오른쪽 아래 전체 모델 요약과 Blender 다운로드는 유지합니다.
사진을 추가할 때는 해당 항목의 폴더에 넣고 `src/data/agentExperiments.ts`의
`images`에 경로와 설명을 등록합니다.

| Blender 항목 | 사진 폴더 (`public/` 아래) |
| --- | --- |
| 중세 무기 | `images/agent-experiments/blender-medieval-weapons/` |
| 음식·가전 | `images/agent-experiments/blender-food/` |
| 지하철 | `images/agent-experiments/blender-subway/` |
| 도시 거리 | `images/agent-experiments/blender-city/` |
| 사무실 | `images/agent-experiments/blender-office/` |

도시 거리는 GPT-6 Astra로 제작한 가상의 한국 도심 「한빛대로」입니다.
2560×1440 JPEG 여섯 장을 재압축 없이 사용하며, 전체 조감도를 첫 이미지로 두고
대로 전경·교차로·서측 인도·동측 인도·횡단보도 모서리 순서로 탐색합니다.
PNG 원본과 Blender 씬은 공개 폴더에 포함하지 않습니다.
사무실은 GPT-6 Astra로 프롬프트를 작성해 GPT Image 2.5로 참고 이미지를 먼저 생성한 뒤,
이를 기준으로 GPT-6 Astra가 Blender 모델링을 진행한 작업입니다.
`imageGroups`를 통해 참고 이미지 `01-reference.png`와 실제 Blender 렌더를 위아래 별도 블록으로 표시합니다.
각 블록 헤더에 제작 단계와 모델을 표시하고, Blender 결과는 입구 전경·책상 상세·반대편 전경·회의실 순서의 슬라이더로 탐색합니다.
렌더는 2560×1440 고품질 JPEG를 재압축 없이 사용하며, PNG 렌더 원본과 Blender 씬은 공개 폴더에 포함하지 않습니다.

음식·가전의 믹서·와플 메이커·토스터 Blender 파일은 각각
`models/agent-experiments/blender-food/`에 공개용으로 두고, 해당 항목의 다운로드 버튼에 연결했습니다.
다른 Blender 항목에는 모델 다운로드를 제공하지 않습니다.

영상은 아래 경로에 공개용 MP4와 표지 이미지를 두고, 같은 데이터 파일의
`video` 또는 모델별 `videos`에 경로를 등록합니다. 기본 재생 컨트롤이 있는 플레이어로 보여줍니다.
원본 영상은 공개 폴더 밖에 보관합니다.
모션그래픽은 `모션그래픽 · Opus 5.5`, `모션그래픽 · GPT-6 Astra` 두 항목으로 구분합니다.
기존 `#motion-graphics` 링크는 Opus 항목을 유지하며, Astra 항목은 `#motion-graphics-astra`로 연결합니다.
Opus 모션그래픽은 15초를 한 번 재생하면 마지막 화면에서 정지합니다. 다시 재생 버튼을 누를 때만 처음부터 시작합니다.
두 항목과 우주선 시뮬레이션 모두 제공된 HTML Canvas 작품을 실시간 재생합니다. MP4 플레이어는 표시하지 않습니다.
HTML 콘텐츠 블록의 헤더에는 `HTML 실시간 재생` 제목을 표시하지 않고 제작 모델만 유지합니다.
다른 이미지·영상도 제작 단계와 모델 헤더가 있는 공통 미디어 블록으로 감싸며,
ComfyUI는 이미지와 영상 각각에 해당 모델을 표시합니다. 모델별 SVG 비교 그리드는 기존 카드별 모델명을 유지합니다.
자동 재생과 사전 영상 다운로드는 하지 않으며, 하나를 재생하면 같은 항목의 다른 영상은 일시정지합니다.
Astra 영상은 제공된 1080p·60fps H.264/AAC MP4를 재인코딩 없이 사용합니다.
모션그래픽 두 항목, 우주선, 키보드 분해도에 `MP4 다운로드` 버튼을 표시하되 현재는 네이티브 `disabled` 버튼으로 비활성화합니다.
파일과 `htmlPreview.download`의 경로·파일명은 보존하며, UI에는 다운로드 링크를 노출하지 않습니다.
파일 자체를 제거하거나 직접 URL 접근을 차단한 것은 아니며, Blender 다운로드에는 영향을 주지 않습니다.
영상물 4번 `키보드 분해도 영상`은 GPT-6 Astra로 제작한 WAVE / 108의 34초 최종본입니다.
조립 → 키캡 웨이브 → 6개 층 수직 전개 → 재결합 순서로 재생하며, HTML에서 회전·확대·속도·단계 이동을 지원합니다.
사이트용 사본은 자동 재생 없이 시작하고 한 번 재생 후 끝에서 정지합니다. Three.js MIT 고지와 내장 효과음을 보존합니다.
원본 HTML·MP4는 그대로 두고, 사이트용 HTML에만 격리 정책·높이 전달과 좁은 화면의 조작부 줄바꿈을 적용합니다.
키보드 음원은 이동 공기음의 고역과 지연 중첩을 완화한 수정본을 사용하며, 34초 영상 스트림과 동작 타이밍은 유지합니다.
HTML의 장면 설명은 3D 화면 아래 별도 영역에 배치해 층별 부품 라벨과 겹치지 않게 합니다. 3D 화면 비율과 MP4는 유지합니다.
5번 `모션 도감`은 Opus 5.5 작품을 HTML로만 재생합니다. `htmlPreview.download`는 선택 항목이며,
지정하지 않은 모션 도감에는 다운로드 버튼이나 MP4 플레이어를 표시하지 않습니다.
모션 도감의 목록 패널과 스크롤바는 사이트의 다크·라이트 테마를 따릅니다.
목록 바깥의 작품 화면 또는 사이트 영역을 누르면 재생 위치를 바꾸지 않고 패널만 닫힙니다.
목록 버튼·L 키로 열고 닫기, Esc 키로 닫기와 항목 선택 후 닫기도 유지합니다.
HTML은 `sandbox="allow-scripts"` iframe에서 실행하며, 사이트 DOM·저장소에 접근하지 않습니다.
현재 iframe이 보낸 높이 정보만 검증해 반영하며, 다른 항목으로 이동하면 iframe을 제거해 재생을 종료합니다.
우주선처럼 화면 전체를 사용하는 작품은 `htmlPreview.layout: 'viewport'`로 지정해 고정 비율 프레임으로 표시합니다.
이 경우 높이 메시지는 받지 않으며, 좁은 모바일 화면에서는 조작 공간을 위해 4:3 비율로 표시합니다.
우주선 HTML의 좁은 화면에서는 재생·음소거·전체 화면 버튼과 화질 선택을 두 줄로 배치해 잘림을 방지합니다.
Astra HTML도 좁은 프레임에서는 조작 버튼을 두 줄로 배치하며, 일반 문서형 프레임 높이는 테두리를 포함해 계산합니다.
Opus의 외부 Google Fonts 연결은 제거하고 파일에 내장된 Unbounded·Anton·Plex Mono·Noto KR을 사용합니다.
폰트 라이선스는 `public/fonts/licenses/`의 각 `*-OFL.txt`에 보관합니다.
Astra의 내장 벡터 글자·UI 폰트·음원과 `asset-credits`의 원본 고지·라이선스는 그대로 보존합니다.
원본 HTML은 수정하지 않았으며, 공개용 사본에만 격리 실행 정책과 필요한 높이 전달 코드를 추가했습니다.
작품의 CSP는 외부 연결을 차단하고 인라인 스크립트·스타일과 내장 data 폰트·음원만 허용합니다.

| 영상 항목 | 파일 경로 (`public/` 아래) | 제작 모델 |
| --- | --- | --- |
| 모션그래픽 · Opus 5.5 (HTML 재생) | `media/agent-experiments/motion-graphics/opus-5-5.html` | Opus 5.5 |
| 모션그래픽 · Opus 5.5 (MP4 다운로드) | `media/agent-experiments/motion-graphics/main.mp4` | Opus 5.5 |
| 모션그래픽 · GPT-6 Astra (HTML 재생) | `media/agent-experiments/motion-graphics/gpt-6-astra.html` | GPT-6 Astra |
| 모션그래픽 · GPT-6 Astra (MP4 다운로드) | `media/agent-experiments/motion-graphics/astra.mp4` | GPT-6 Astra |
| 우주선 시뮬레이션 (HTML 재생) | `media/agent-experiments/spaceship-simulation/far-reach.html` | Opus 5.5 |
| 우주선 시뮬레이션 (MP4 다운로드) | `media/agent-experiments/spaceship-simulation/main.mp4` | Opus 5.5 |
| 키보드 분해도 (HTML 재생) | `media/agent-experiments/keyboard-exploded-view/main.html` | GPT-6 Astra |
| 키보드 분해도 (MP4 다운로드 잠금) | `media/agent-experiments/keyboard-exploded-view/main.mp4` | GPT-6 Astra |
| 모션 도감 (HTML 재생 전용) | `media/agent-experiments/motion-atlas/main.html` | Opus 5.5 |

ComfyUI 활용 첫 사례는 `images/agent-experiments/comfyui/cafe-qwen-image-2512.png`의
생성 이미지와 `media/agent-experiments/comfyui-qwen-wan/cafe-i2v-5s.mp4`의
5초 영상을 나란히 표시합니다. 워크플로우와 프롬프트는 GPT-6 Sol, 이미지는 Qwen Image 2512
FP8 E4M3FN, 영상은 Wan 2.2 I2V 14B FP8을 사용했습니다. 공개용 영상은 브라우저
호환성을 위해 H.264로 변환했고, 사용자가 준 HEVC 원본은 다운로드 폴더에 남겨뒀습니다.
두 번째 사례는 `images/agent-experiments/comfyui/astronaut-gpt-image-2.png`의
GPT Image 2 이미지와 `media/agent-experiments/comfyui-gpt-image2-wan/astronaut-i2v-5s.mp4`의
Wan 2.2 I2V 14B FP8 5초 영상을 함께 표시합니다. 두 번째 영상은 이미 H.264라
원본을 그대로 복사했으며, 확인되지 않은 워크플로우·프롬프트 제작 모델은 표기하지 않습니다.

## 공개 범위

이 디렉터리에는 브라우저에서 동작하는 화면과 공개 가능한 프런트엔드 코드만
포함합니다. 비공개 지식 원문, 추론 서버 설정과 인증 정보는 별도 비공개
백엔드에서 관리합니다.

## 다크 테마 표면

다크모드는 Colab 런처의 무광 표면을 참고한 저채도의 차가운 회색 팔레트를 사용합니다.
페이지 배경 `#111315`, 카드 `#1b1e22`, 보조 표면 `#24282d`, 테두리 `#34383e`를 공통 토큰으로 관리합니다.
다크 전용 규칙으로 카드·채팅·둘러보기의 그림자와 장식 그라데이션을 제거하며,
`--surface-fill`과 `--surface-pattern-opacity`는 안내 카드 배경과 점 패턴을 제어합니다.
라이트모드는 기존 색상·그림자·그라데이션을 유지합니다.

기본 인디고 선택은 다크모드에서만 `#326bd3` 블루와 흰 글자로 표시합니다. 저장된 팔레트 이름과
다른 포인트 색상은 바꾸지 않습니다. 이 모드별 표현은 `globals.css`에서 Provider의 인라인
토큰보다 우선하며, 버튼 글자는 `--accent-contrast`로 대비를 확보합니다.
레이아웃·모서리·미디어 원본과 HTML 작품 내부 디자인은 변경하지 않습니다.

## 포트폴리오 챗봇

모든 페이지 오른쪽 아래의 버튼으로 열리는 AI 챗봇입니다. 공개된 포트폴리오
내용을 근거로 답하고, 답변에서 관련 화면으로 바로 이동할 수 있습니다.
채팅 입력창의 사고 모드 전환 버튼은 현재 숨겨져 있습니다. 브라우저의 화면·설정
변경은 서버가 보낸 도구 지시를 검증한 뒤 실행하고 실제 반영 여부를 다시 확인합니다.

구조와 데이터 흐름은 [`docs/chatbot-architecture.md`](docs/chatbot-architecture.md)에
머메이드 다이어그램으로 정리해 두었습니다.

### 환경변수

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_RAG_API_BASE_URL` | 예 | 공개 RAG API의 기본 주소입니다. 비어 있으면 챗봇은 열리되 "채팅 서버 주소가 설정되지 않았습니다" 안내로 실패합니다. |
| `NEXT_PUBLIC_BASE_PATH` | 아니오 | GitHub Pages 하위 경로 배포용입니다. 배포 워크플로가 주입하고, 로컬에서는 비어 있습니다. |
| `LOCAL_DEV_IP` | 아니오 | 같은 Wi-Fi의 모바일에서 `next dev`에 접속할 때 필요한 노트북 IPv4입니다. 없으면 IP 접속 시 인터랙션이 차단됩니다. |

브라우저에 노출돼도 되는 값만 씁니다. API 키와 모델 서버 주소는 비공개
저장소에서 관리합니다. `.env.example`을 복사해 `.env.local`을 만드세요.

### 오류·중단 시 화면 동작

말투 드롭다운은 영역을 유지한 채 비활성화하며 **공식 안내자**로 고정합니다.
기존에 저장된 말투도 공식 안내자로 정규화합니다. 관점 선택은 계속 사용할 수 있습니다.
둘러보기 진행 중에는 인사말 다음의 별도 말풍선으로 하단 카드의 `다음 장소`·`종료` 버튼과
채팅 질문 방법을 안내합니다. 화면 전용 안내라 모델을 호출하거나 대화 기록에 추가하지 않으며,
단계 이동 시 중복되지 않고 둘러보기를 종료하면 숨깁니다.
둘러보기는 챗봇의 온라인 여부와 무관하게 시작하고 진행할 수 있습니다.
첫 방문 안내와 채팅의 연결 확인·오프라인 화면에서 시작할 수 있으며, 질문 체험은 오프라인일 때 건너뜁니다.
둘러보기는 총 35단계입니다. 과거 작업 아카이브 다음인 3번째 단계에서 SI 표기 안내 카드를
방문하고 잠시 강조한 뒤 협업 프로젝트로 이어집니다. 프로젝트 소개 다음인 5번째 단계는
`SI 활용 실험`의 상단 설명 박스(`#agent-experiments-intro`)만 강조합니다.
6~12번째 단계는 SVG·WebGL·2D 게임·3D 게임·Blender·영상물·ComfyUI 대분류를 각각 한 번 선택한 뒤
이력서로 이어집니다. 소분류는 자동 순회하지 않고 각 분류의 첫 공개 작업물을 표시합니다.
자기소개서 소개 다음에는 탐구심과 개발 경험, 경력의 전환점을 거칩니다.
연구 여정 개요 다음에는 학창 시절과 2022~2026년을 각각 방문한 뒤 성능 최적화와 개발 도구 및 AI 활용으로 이어집니다.
연구 경험 다음에는 SI 활용 단계 소개와 01~05를 하나씩 둘러본 뒤 기록으로 이동합니다.
SI 단계별 제목과 설명은 본문 데이터를 재사용하며, 이전·다음 장소·현재 장소 이동은 프런트에서 처리합니다.
이동 중에는 둘러보기 버튼을 잠그고 해당 앵커의 스크롤 도착 신호를 받은 뒤 다시 활성화합니다.
연속 입력은 렌더 반영 전에도 차단하며, 목적지를 찾지 못한 경우에는 8초 후 잠금을 풀어 재시도할 수 있게 합니다.
01~05는 각 섹션의 번호·제목·설명을 묶은 헤더(`#workflow-header-*`)로 이동해 강조합니다.
헤더에는 강조 테두리 안쪽 여백과 둥근 모서리를 두며, 소개 카드의 원 장식은 강조용 가상 요소와 분리합니다.
대분류 앵커와 기존 작품별 직접 링크는 같은 선택 로직을 사용하며, `현재 장소`로 돌아오면 해당 분류를 복원합니다.
단계 구성 변경 시 저장 버전도 갱신해 이전 진행 번호가 다른 섹션에 연결되지 않도록 합니다.
관점·추천 질문·AI에게 물어보기 버튼은 `responseMode: explanation`으로 설명을 요청합니다.
해당 요청은 모델의 화면 변경 도구 없이 근거 기반 설명을 받으며, 짧은 인사만 오면 한 번
재생성을 요청합니다. 직접 입력한 일반 채팅의 도구 호출 기능과는 별개입니다.

- **연결 확인 중**: 채팅을 열면 먼저 `/api/chat/status`를 확인합니다. 확인이
  끝날 때까지 준비 중 화면을 보여 줍니다.
- **대화 전 오프라인**: 화면 전체를 오프라인 안내로 바꾸고 "다시 확인" 버튼을
  제공합니다. 포트폴리오의 다른 내용은 정상이라는 점을 함께 알립니다.
- **대화 중 오프라인**: 화면을 갈아 끼우지 않습니다. 목록 위에 얇은 배너만
  띄우고 입력창을 유지해, 검색 결과 기반(retrieval fallback) 답변을 계속
  받을 수 있게 합니다.
- **생성 실패**: 실패 사유를 그 답변 말풍선 바로 아래에 붙이고, 마지막 실패에만
  재시도 버튼을 노출합니다. 429 응답은 서버가 알려 준 대기 시간 동안 버튼을
  잠그고 남은 초를 셉니다.
- **도구 호출 실패 설명**: 서버가 `tool_call_failed`에 안전한 `explanation`을 보내면
  실패 알림 뒤에 별도 설명 말풍선을 붙입니다. 같은 요청에서 설명 모델 호출도
  실패하면 서버의 고정 안내를 사용합니다. 재시도 때 두 말풍선을 제거하고,
  실패한 턴과 설명은 다음 모델 대화 이력에서 제외합니다.
- **시간 초과**: 전체 8분, 마지막 수신 뒤 유휴 60초를 넘기면 스스로 끊고
  사용자 중단과 구분되는 안내를 보여 줍니다. keep-alive 주석은 유휴 타이머를
  되감습니다.
- **사용자 중단**: 그때까지 받은 글을 남긴 채 중단 배지를 붙입니다. 실패한
  답변과 그 질문은 다음 요청의 대화 기록에서 함께 빠집니다.
- **도구 결과 상태 줄**: 실제로
  도착하거나 설정이 반영되면 `도구 호출 · 작업 이름`으로 표시합니다. 실패했는지는
  답변 말풍선 위의 상태 줄이 보여 줍니다. 서버의 `uiToolOutcome=called`는 지시가
  전달됐다는 뜻일 뿐 완료를 보증하지 않으며, 필수 도구가 끝내 실패하면 성공 답변이
  아닌 오류 이벤트로 처리합니다.

### WebMCP 도구

WebMCP에는 채팅 모델과 이름이 같은 **UI 도구 12개**만 등록합니다. 기록 목차 조회·열기
도구는 등록하지 않으며, 기록 페이지의 직접 검색·상세 이동 API와 기본 RAG는 유지합니다.
색상 순회는 한 번의 도구 호출 안에서 다섯 색을 차례로 보여 주고 시작 색으로 돌아옵니다.
채팅과 WebMCP가 같은 중단·원복 로직을 씁니다. 브라우저가 공유하는 도구 실행 경로는
[`docs/chatbot-architecture.md`](docs/chatbot-architecture.md#3-도구-실행이-한곳으로-모이는-길)를 참고하세요.

툴 이름은 챗봇·WebMCP·모델 API 모두 snake_case로 통일합니다. 이전 서버에서 온
하이픈 이름은 응답 파서에서만 정규화하며, WebMCP에는 언더스코어 이름만 등록합니다.
URL·앵커·action 식별자와 글꼴 값 등은 이 이름 변경의 대상이 아닙니다.

`document.modelContext`를 제공하는 브라우저·에이전트 환경에서만 등록됩니다.
지원하지 않는 환경에서는 등록 코드 자체를 내려받지 않습니다.

| 도구 | read-only | 하는 일 |
| --- | --- | --- |
| `get_portfolio_ui_settings` | ✅ | 현재 테마·포인트 색상·채팅 레이아웃·글꼴·글자 크기·답변 연출을 읽습니다. |
| `get_portfolio_view_state` | ✅ | 현재 페이지·앵커·연구 탭·연구 연도·상세 펼침 상태를 읽습니다. |
| `set_portfolio_theme` | ❌ | 라이트·다크 모드를 바꿉니다. |
| `set_portfolio_accent` | ❌ | 포인트 색상을 바꿉니다. |
| `cycle_portfolio_accent` | ❌ | 포인트 색상 다섯 가지를 차례로 보여 주고 시작 색으로 복귀합니다. 중단되면 원복합니다. |
| `set_portfolio_chat_layout` | ❌ | 채팅 패널을 플로팅·오른쪽 고정으로 바꿉니다. |
| `set_portfolio_chat_font` | ❌ | 채팅 글꼴을 바꿉니다. |
| `set_portfolio_chat_font_size` | ❌ | 채팅 글자 크기를 바꿉니다. |
| `set_portfolio_stream_animation` | ❌ | 답변 스트리밍 연출을 바꿉니다. |
| `control_portfolio_view` | ❌ | `action` 하나로 페이지·연구 탭·연구 연도·소개 페이지 안의 섹션과 개별 항목으로 이동합니다. |
| `control_portfolio_research_details` | ❌ | `action: expand\|collapse`, `target: all\|2011\|2022\|2023\|2024\|2025\|2026`으로 모든 대상 카드의 상세를 지정 상태로 만듭니다. |
| `open_portfolio_settings` | ❌ | 설정 페이지로 이동합니다. |

read-only가 아닌 도구는 화면을 실제로 바꾸거나 이동시킵니다. 허용값과 입력
스키마는 `src/features/portfolio-tools/settings.ts`, `view.ts`의 도메인
정의에서 만들고, `ToolDefinition`/`ToolRegistry`와 호환 진입점 `schema.ts`를 통해
챗봇 응답 파서와 WebMCP 등록이 같은 정의를 씁니다. 다만 서버가 쥔 같은 목록(비공개
`backend/src/shared/view-targets.js`)과는 저장소가 갈라져 있어 **수동으로**
맞춥니다. 목적지를 더할 때는 양쪽을 함께 고쳐야 합니다.

`control_portfolio_view`의 이동 목적지는 36개입니다. 이동은 `action`만 받으며 `year`와 `target`은 받지 않습니다.
연구 상세 펼침·접기는 별도 `control_portfolio_research_details` 도구가 `action`과 `target`을 모두 받아 처리합니다.

| 묶음 | action |
| --- | --- |
| 페이지 | `main`, `overview`, `resume`, `cover-letter`, `research`, `log` |
| 개발·배포 환경 | `architecture`(기본 개발 탭), `development-environment`, `deployment-overview`, `infrastructure-optimization`, `migration-memory-history` |
| SI 활용 단계 | `si-levels`, `si-level-chat`, `si-level-read-only`, `si-level-implementation`, `si-level-tools`, `si-level-orchestration` |
| SI 실제 사례 | `si-tools-ffmpeg`, `si-session-messaging` |
| 연구 탭·연도 | `research-timeline`, `research-optimization`, `research-tools`, `research-2011`(학창 시절), `research-2022`~`research-2026` |
| 소개 페이지 섹션 | `past-work-archive`, `ai-collaboration-projects` |
| 과거 작업 항목 | `archive-canvas-dodge-game`, `archive-wpf-excel-row-mapper`, `archive-android-ar-campfire` |
| SI 협업 프로젝트 항목 | `project-common-infrastructure`, `project-ecommerce-demo`, `project-code-archive` |

개발·배포 환경 이동은 해당 탭을 먼저 열고 앵커 도착을 확인합니다. 화면 조회의
`page: "architecture"`와 `anchor`는 실제 마운트된 본문을 기준으로 보고합니다.
SI 화면은 API `pageContext: "ai_workflow"`, 화면 상태 `page: "ai-workflow"`를 사용합니다.
사례 해시는 해당 단계 슬라이드를 먼저 열며, URL에만 맞는 비활성 슬라이드는
상태·도착으로 인정하지 않습니다. 원문 이력·네이티브 도구 ID와 브라우저 확인 경로는 유지합니다.
백엔드 v48 계약과 프런트를 함께 맞춰 반영해야 분리된 상세 도구와 새 문맥을 사용할 수 있습니다.
앵커 이동은 비활성·숨김·전환 상태를 거부하고, 실제 위치가 해당 요소의
`scroll-margin-top`과 문서의 `scroll-padding-top`에 맞았을 때 도착을 알립니다.
Swiper 높이가 바뀌어 좌표가 달라지면 기존 제한 시간 안에서 다시 계산합니다.
자체 애니메이션의 매 프레임은 `behavior: instant`로 적용해 전역 CSS smooth와 중첩하지 않습니다.

학창 시절 연구 경험의 내부 탐색 연도는 `2011`입니다. 페이지의 시기 표시는
`학창 시절`로 유지하며, `research-2011`은 `#research-year-2011`로 이동합니다.
연도별 연구 상세 제어의 `target: "2011"`도 같은 두 카드를 대상으로 합니다.

이동 완료는 URL 변경만으로 보고하지 않습니다. 실제 경로·활성 DOM을 확인하고,
앵커가 있으면 스크롤 정렬 후 발행되는 도착 신호도 기다립니다. 해시 없는 연구·설정
이동도 각각 해당 페이지 본문이 준비돼야 완료됩니다. 상세 제어는 이동 발행 전에
도착 신호를 구독하며, 목표 앵커의 도착·현재 정렬과 대상 카드 전부의 지정된
펼침·접힘 상태를 함께 확인한 뒤 `applied` 또는 `failed`를 반환합니다.
따라서 카드가 먼저 바뀌어도 스크롤 중인 다른 연도를 후속 최종 관측으로 보내지 않습니다.
이 관측은 사용자 명령 뒤 로컬 DOM만 최대 8초 확인하며 추론 서버 상태를 폴링하지 않습니다.

### 지연 로딩

첫 화면에 필요하지 않은 코드는 실제로 쓰일 때 내려받습니다.

- **react-markdown**: 답변을 완료 상태로 그릴 때만 필요합니다. 채팅을 여는
  순간 미리 불러 두고, 도착 전에는 같은 자리에 평문으로 보여 줍니다.
- **ElasticJellyPanel**: 젤리 연출로 패널이 열릴 때 불러옵니다. 불러오지
  못하면 젤리를 포기하고 평범한 패널로 되돌립니다.
- **WebMCP 도구 등록**: `document.modelContext`가 있는 환경에서만 불러옵니다.
  챗봇의 기본 RAG 검색과 기록 페이지의 직접 검색은 이와 무관하게 동작합니다.

이 분리로 랜딩 페이지가 처음 받는 JS가 gzip 기준 약 37 kB 줄었습니다
(258.5 kB → 221.6 kB, 2026-09 측정).

### 개발·검증 명령

```bash
npm run dev        # 개발 서버
npm run build      # 정적 export 빌드 (out/)
npm run lint       # ESLint
npm test           # 순수 로직 테스트 (node --test)
```

`npm test`는 다음 브라우저 없는 순수 로직 묶음을 실행합니다.

- `src/features/chat/parse.test.mjs` — SSE 블록 파싱, 응답 검증, 도구 실행
  허용값, 재시도 대기 시간 환산
- `src/features/chat/modelHistory.test.mjs` — 공개 native 호출/결과 이력, 실제 브라우저 결과
  교체, 확인 재시도, 사용자 턴 단위 보존 및 문자 예산
- `src/features/chat/chatFailure.test.mjs`, `chatRequestIdentity.test.mjs` — 실패/중단 이력 제외,
  오류 원문 미노출, 동일 대화·입력 ID와 reset/재시도 수명
- `src/features/webmcp/logViewContract.test.mjs` — 기록 검색 결과를 목록
  화면 상태로 좁히는 계약
- `scripts/local-fonts.test.mjs` — 로컬 폰트 파일·해시·라이선스와 외부 Google Fonts 요청 제거
- `scripts/theme.test.mjs` — 다크 표면·버튼 대비, 라이트 테마와 저장 팔레트 보존
- `src/data/agentExperiments.test.mjs` — 실험별 제작 모델·버전·음악 제작 경로와 숨김 상태
- `src/data/research.test.mjs` — 연구 문구·제목과 측정 수치, 연구 탭·시기 계약
- `src/components/about/mediaSwiperPolicy.test.mjs` — 모션 정책과 원본 index 경계,
  두 갤러리의 native 이동·접근성·재오픈 계약. 실제 드래그/영상 컨트롤 QA는 별도 수행
- `src/components/about/mediaDialogPolicy.test.mjs` — Radix 공통 팝업 연결, 바깥 클릭
  보호 경계, iframe 격리와 공개 라이선스 고지
- `src/lib/logApi.test.mjs` — Zod 목록·상세 스키마, 응답·HTTP 오류·연결 오류·취소와
  기존 조회 계약, 직접 의존성 버전과 공개 라이선스 고지

타입 검사는 `npx tsc --noEmit`으로 따로 실행합니다.

완료된 채팅은 선택 `modelHistory`에 공개 assistant 호출·tool 결과·최종 답변이 있을 때
다음 요청의 이력으로 그대로 펼칩니다. 비공개 system/RAG·추론 본문을 보관하지 않으며
visible assistant 답변을 중복하지 않습니다. 기본은 사용자 대화 묶음 5개·wire 130개·전체
12,000자이고, 오래된 사용자 턴을 통째로 제거해 orphan tool 결과를 만들지 않습니다.
브라우저 확인 요청이 실패한 재시도는 원래 질문과 관측 `toolHistory`로 보고만 다시 요청해
이미 적용한 변경을 반복하지 않습니다. 필드가 없는 구형 API 응답은 기존 일반 이력으로
처리합니다. 대화/이력은 브라우저 메모리에만 두며 전체 KV 캐시 적중률을 보장하지 않습니다.

### 폰트 파일

Noto Sans KR와 JetBrains Mono는 [`src/assets/fonts/`](src/assets/fonts/README.md)에
파일을 보관해 빌드 시 Google Fonts 다운로드 없이 사용합니다. 브라우저도 두 글꼴을
사이트의 정적 자산에서 읽습니다. 한글의 글자 범위별 분할과 가변 굵기를 유지하며,
OFL 라이선스는 `public/fonts/licenses/`를 통해 배포에 포함합니다.
기본 본문 글꼴 Pretendard의 기존 jsDelivr 로딩은 별개로 유지합니다.

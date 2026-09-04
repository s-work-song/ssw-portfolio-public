# SSW 포트폴리오 웹

소프트웨어 엔지니어 송상운의 경험과 개발에 대한 관점을 소개하는 공개
포트폴리오의 웹 프런트엔드입니다.

[포트폴리오 바로가기](https://s-work-song.github.io/ssw-portfolio-public/about-me/)

## 주요 화면

- **소개**: 경력과 작업 방식, 공개 프로젝트 개요
- **이력서**: 실무 경험과 기술 역량
- **자기소개서**: 개발·협업에 대한 생각
- **연구 경험**: 성능 최적화와 AI 에이전트 활용 과정
- **기록**: 기술적 성찰과 개인적인 회고
- **포트폴리오 AI**: 공개된 내용을 질문으로 탐색하는 안내 기능

## 공개 범위

이 디렉터리에는 브라우저에서 동작하는 화면과 공개 가능한 프런트엔드 코드만
포함합니다. 비공개 지식 원문, 추론 서버 설정과 인증 정보는 별도 비공개
백엔드에서 관리합니다.

## 포트폴리오 챗봇

모든 페이지 오른쪽 아래의 버튼으로 열리는 AI 챗봇입니다. 공개된 포트폴리오
내용을 근거로 답하고, 답변에서 관련 화면으로 바로 이동할 수 있습니다.

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
- **시간 초과**: 전체 8분, 마지막 수신 뒤 유휴 60초를 넘기면 스스로 끊고
  사용자 중단과 구분되는 안내를 보여 줍니다. keep-alive 주석은 유휴 타이머를
  되감습니다.
- **사용자 중단**: 그때까지 받은 글을 남긴 채 중단 배지를 붙입니다. 실패한
  답변과 그 질문은 다음 요청의 대화 기록에서 함께 빠집니다.
- **도구 결과 상태 줄**: 실제로
  도착하거나 설정이 반영되면 `도구 호출 · 작업 이름`으로 표시합니다. 실패했는지는
  답변 말풍선 위의 상태 줄이 보여 줍니다. 서버가 "도구를 써야 하는 요청인데
  끝내 실행하지 않았다"고 알리면 그 사실도 실패 한 줄로 남습니다.

### WebMCP 도구

로그 검색·연관 기록 검색은 챗봇과 WebMCP에서 제공하지 않습니다. 기록 페이지의
직접 검색과 기본 RAG는 유지하며, WebMCP에는 UI 10개와 기록 목차·열기 2개를 등록합니다.

툴 이름은 챗봇·WebMCP·모델 API 모두 snake_case로 통일합니다. 이전 서버에서 온
하이픈 이름은 응답 파서에서만 정규화하며, WebMCP에는 언더스코어 이름만 등록합니다.
URL·앵커·action 식별자와 글꼴 값 등은 이 이름 변경의 대상이 아닙니다.

`document.modelContext`를 제공하는 브라우저·에이전트 환경에서만 등록됩니다.
지원하지 않는 환경에서는 등록 코드 자체를 내려받지 않습니다.

| 도구 | read-only | 하는 일 |
| --- | --- | --- |
| `get_portfolio_ui_settings` | ✅ | 현재 테마·포인트 색상·채팅 레이아웃·글꼴·글자 크기·답변 연출을 읽습니다. |
| `get_portfolio_view_state` | ✅ | 현재 페이지·앵커·연구 탭·연구 연도·상세 펼침 상태를 읽습니다. |
| `get_portfolio_log_outline` | ✅ | 기록 하나의 제목·요약·태그와 소제목 목록을 읽습니다. |
| `set_portfolio_theme` | ❌ | 라이트·다크 모드를 바꿉니다. |
| `set_portfolio_accent` | ❌ | 포인트 색상을 바꿉니다. |
| `set_portfolio_chat_layout` | ❌ | 채팅 패널을 플로팅·오른쪽 고정으로 바꿉니다. |
| `set_portfolio_chat_font` | ❌ | 채팅 글꼴을 바꿉니다. |
| `set_portfolio_chat_font_size` | ❌ | 채팅 글자 크기를 바꿉니다. |
| `set_portfolio_stream_animation` | ❌ | 답변 스트리밍 연출을 바꿉니다. |
| `control_portfolio_view` | ❌ | 페이지·연구 탭·연구 연도·소개 페이지 안의 섹션과 개별 항목으로 이동하고 연구 상세를 펼치거나 접습니다. |
| `open_portfolio_settings` | ❌ | 설정 페이지로 이동합니다. |
| `open_portfolio_log` | ❌ | 기록 상세 또는 지정한 소제목 위치로 이동합니다. |

read-only가 아닌 도구는 화면을 실제로 바꾸거나 이동시킵니다. 허용값과 입력
스키마는 `src/features/portfolio-tools/settings.ts`, `view.ts`, `logs.ts`의 도메인
정의에서 만들고, `ToolDefinition`/`ToolRegistry`와 호환 진입점 `schema.ts`를 통해
챗봇 응답 파서와 WebMCP 등록이 같은 정의를 씁니다. 다만 서버가 쥔 같은 목록(비공개
`backend/src/shared/view-targets.js`)과는 저장소가 갈라져 있어 **수동으로**
맞춥니다. 목적지를 더할 때는 양쪽을 함께 고쳐야 합니다.

`control_portfolio_view`의 이동 목적지는 27개입니다.

| 묶음 | action |
| --- | --- |
| 페이지 | `main`, `overview`, `resume`, `cover-letter`, `research`, `log` |
| 연구 탭·연도 | `research-timeline`, `research-optimization`, `research-tools`, `research-2022`~`research-2026` |
| 연구 상세 제어 | `expand-research-details`, `collapse-research-details`, `expand-research-year-details`, `collapse-research-year-details` |
| 소개 페이지 섹션 | `past-work-archive`, `ai-collaboration-projects` |
| 과거 작업 항목 | `archive-canvas-dodge-game`, `archive-wpf-excel-row-mapper`, `archive-android-ar-campfire` |
| AI 협업 프로젝트 항목 | `project-common-infrastructure`, `project-ecommerce-demo`, `project-game-collection-platform`, `project-code-archive` |

### 지연 로딩

첫 화면에 필요하지 않은 코드는 실제로 쓰일 때 내려받습니다.

- **react-markdown**: 답변을 완료 상태로 그릴 때만 필요합니다. 채팅을 여는
  순간 미리 불러 두고, 도착 전에는 같은 자리에 평문으로 보여 줍니다.
- **ElasticJellyPanel**: 젤리 연출로 패널이 열릴 때 불러옵니다. 불러오지
  못하면 젤리를 포기하고 평범한 패널로 되돌립니다.
- **WebMCP 도구 등록**: `document.modelContext`가 있는 환경에서만 불러옵니다.
  챗봇의 기록 검색 결과 반영은 이와 무관하게 항상 동작합니다.

이 분리로 랜딩 페이지가 처음 받는 JS가 gzip 기준 약 37 kB 줄었습니다
(258.5 kB → 221.6 kB, 2026-09 측정).

### 개발·검증 명령

```bash
npm run dev        # 개발 서버
npm run build      # 정적 export 빌드 (out/)
npm run lint       # ESLint
npm test           # 순수 로직 테스트 (node --test)
```

`npm test`는 브라우저 없이 도는 두 묶음을 실행합니다.

- `src/features/chat/parse.test.mjs` — SSE 블록 파싱, 응답 검증, 도구 실행
  허용값, 재시도 대기 시간 환산
- `src/features/webmcp/logViewContract.test.mjs` — 기록 검색 결과를 목록
  화면 상태로 좁히는 계약

타입 검사는 `npx tsc --noEmit`으로 따로 실행합니다.

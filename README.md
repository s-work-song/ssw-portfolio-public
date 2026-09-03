# SSW 소개 페이지

소프트웨어 엔지니어 송상운의 경험, 연구, 작업 방식과 가치관을 정리한 공개 포트폴리오입니다.

[소개 페이지 바로가기](https://s-work-song.github.io/ssw-portfolio-public/about-me/)

## 주요 구성

- **소개**: 주요 경력과 AI 에이전트들과 협업한 프로젝트를 소개합니다.
- **이력서**: 실무 경력, 역할과 기술 역량을 정리합니다.
- **자기소개서**: 개발을 대하는 관점과 협업 기준을 설명합니다.
- **연구 경험**: 하드웨어, 성능 최적화와 AI 에이전트 활용 과정을 기록합니다.
- **기록**: 기술적 성찰과 개인적인 경험에서 정리한 생각을 공유합니다.
- **포트폴리오 AI**: 공개된 포트폴리오 내용을 질문 형식으로 탐색할 수 있습니다.

## 저장소 구성

| 경로 | 내용 |
| --- | --- |
| `web/` | Next.js 정적 export 프런트엔드. 화면·챗봇 UI·WebMCP 도구가 모두 여기 있습니다. |
| `web/docs/` | 프런트엔드 구조 문서. 챗봇 구조는 [`web/docs/chatbot-architecture.md`](web/docs/chatbot-architecture.md) 참고. |
| `packages/`, `services/`, `sample-apps/` | 공개 가능한 예제와 보조 코드. |
| `benchmarks/` | 연구 경험 페이지가 인용하는 측정 근거. |
| `.github/workflows/` | GitHub Pages 배포 워크플로. |

## 유지 대상

- `web/src/app/about-me/`와 관련 콘텐츠 데이터 — 이 포트폴리오의 핵심 자산입니다.
  함부로 삭제하지 않습니다.
- `web/src/features/chat/`, `web/src/features/portfolio-tools/`,
  `web/src/features/webmcp/` — 챗봇과 도구 연동의 공개 구현입니다.
- `benchmarks/` — 연구 경험 페이지의 수치가 근거로 삼는 자료입니다.
- 배포 워크플로와 `NEXT_PUBLIC_BASE_PATH` 설정 — 저장소 이름을 바꾸면
  `package.json`, 워크플로, 문서의 공개 URL을 함께 맞춰야 합니다.

## 이 저장소에 두지 않는 것

- RAG 추론 서버, 프롬프트, 인덱싱 파이프라인과 인증 정보
- 기록(로그) 원문 — 비공개 저장소의 `content/logs/public|hold`에서 관리하고,
  이 저장소에는 API로 조회하는 UI만 둡니다.
- 개인 식별 정보가 담긴 원본 자료와 작업용 임시 폴더(`.agents-ssw/`)

## 로컬 실행

```bash
cd web
cp .env.example .env.local   # NEXT_PUBLIC_RAG_API_BASE_URL 설정
npm install
npm run dev
```

빌드·검증 명령과 챗봇 환경변수는 [`web/README.md`](web/README.md)에 정리돼 있습니다.

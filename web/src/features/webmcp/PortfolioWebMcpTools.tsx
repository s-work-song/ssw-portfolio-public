'use client';

/**
 * 브라우저의 WebMCP 모델 컨텍스트에 포트폴리오 도구를 등록하는 컴포넌트다.
 *
 * WebMCP를 지원하는 환경에서만 필요하고 도구 설명 문구가 길어서, 지원을
 * 확인한 뒤에만 지연 로딩된다(`PortfolioWebMcp` 게이트가 판단한다).
 *
 * 화면을 바꾸는 도구는 스스로 구현하지 않고 챗봇과 같은 실행기
 * (`executePortfolioUiTool`)에 넘긴다. 허용값·검증·부작용이 한 곳에 모여야
 * 두 경로가 같은 결과를 내기 때문이다.
 */
import { useEffect } from 'react';
import { useChat } from '@/features/chat';
import {
  PORTFOLIO_UI_TOOLS,
  PORTFOLIO_UI_TOOL_NAMES,
  type PortfolioUiToolName,
} from '@/features/portfolio-tools/schema';

/** 도구 결과를 WebMCP가 요구하는 텍스트 콘텐츠 형태로 감싼다. */
function toolResult(payload: unknown): WebMcpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}

/**
 * 실패를 도구 결과로 바꾼다.
 *
 * 예외를 그대로 던지면 호출한 에이전트가 원인을 알 수 없다. 사람이 읽을 수
 * 있는 문구로 바꿔 `ok: false`와 함께 돌려준다.
 */
function toolError(error: unknown): WebMcpToolResult {
  return toolResult({
    ok: false,
    error: error instanceof Error ? error.message : 'WebMCP 도구 실행 중 오류가 발생했습니다.',
  });
}

/** 화면을 바꾸지 않는 도구에 붙이는 표시다. */
const READ_ONLY_ANNOTATIONS = { readOnlyHint: true } as const;

/**
 * UI 도구의 이름 외 표현(제목·설명·읽기 전용 여부)이다.
 *
 * 입력 스키마와 검증은 `portfolio-tools/schema`가 쥐고, 여기에는 에이전트에게
 * 보여 줄 문구만 둔다. 안내 문구가 지연 로딩되는 이 청크에만 실리도록
 * 나눠 놓은 것이다.
 */
const UI_TOOL_PRESENTATION: Readonly<
  Record<
    PortfolioUiToolName,
    { title: string; description: string; readOnly?: boolean }
  >
> = {
  'get_portfolio_ui_settings': {
    title: '현재 포트폴리오 UI 설정 확인',
    description:
      '현재 사이트 테마(theme: light/dark/system), 포인트 색상(accent), 채팅 레이아웃(chatLayout), 글꼴(chatFont), 글자 크기(chatFontSize)와 스트리밍 연출(streamAnimation)을 읽습니다. 인자는 빈 객체이며 화면을 변경하지 않습니다.',
    readOnly: true,
  },
  'set_portfolio_theme': {
    title: '포트폴리오 화면 모드 변경',
    description:
      '사용자가 명시적으로 요청한 경우 theme을 light(라이트), dark(다크), system(운영체제 설정 따르기) 중 하나로 변경합니다.',
  },
  'set_portfolio_accent': {
    title: '포트폴리오 포인트 색상 변경',
    description:
      '사용자가 명시적으로 요청한 accent으로 버튼과 강조 요소의 색을 변경합니다. blue(로얄블루, 기본), indigo(인디고), emerald(에메랄드), amber(앰버), rose(로즈), violet(바이올렛) 중 하나를 사용합니다.',
  },
  'set_portfolio_chat_layout': {
    title: '포트폴리오 채팅 레이아웃 변경',
    description:
      'layout을 floating(떼어 놓은 플로팅 창) 또는 dock(오른쪽 고정 패널)으로 변경합니다. 좁은 화면에서는 floating이 적용됩니다.',
  },
  'set_portfolio_chat_font': {
    title: '포트폴리오 채팅 글꼴 변경',
    description:
      '채팅 메시지와 입력창, 추천 질문의 font를 pretendard(Pretendard), noto-sans-kr(Noto Sans KR), system(시스템 글꼴) 중 하나로 변경합니다.',
  },
  'set_portfolio_chat_font_size': {
    title: '포트폴리오 채팅 글자 크기 변경',
    description:
      '채팅 메시지와 입력창, 추천 질문의 size를 small(작게), medium(기본), large(크게), xlarge(매우 크게) 중 하나로 변경합니다.',
  },
  'set_portfolio_stream_animation': {
    title: '채팅 스트리밍 연출 변경',
    description:
      '사용자가 명시적으로 요청한 채팅 답변의 animation을 none, typewriter, word-fade, token-chunks, blur-focus, slide-up, skeleton, mask-wipe, scramble, letter-drop, highlight-trail 중 하나로 변경합니다. 스트리밍 사용 여부 자체는 변경하지 않습니다.',
  },
  'get_portfolio_view_state': {
    title: '현재 포트폴리오 화면 상태 확인',
    description:
      '현재 보고 있는 포트폴리오 페이지와 앵커 위치, 활성 연구 탭, 화면에 가장 많이 보이는 연구 연도 및 연구 상세 펼침 상태를 읽습니다. 화면을 변경하지 않습니다.',
    readOnly: true,
  },
  'control_portfolio_view': {
    title: '포트폴리오 화면 이동',
    description:
      '개발·배포 환경 페이지는 architecture, 개발 환경·접속 경로는 development-environment, 배포 구성은 deployment-overview, Rust 전환 메모리 비교는 migration-memory-history로 이동합니다. ' +
      '메인·홈 요청은 main 또는 overview로 소개 Overview에, 이력서는 resume, 자기소개서는 cover-letter, 연구 경험은 research로 이동합니다. 연구 여정·성능 최적화·도구 & AI 접목 탭은 research-timeline/research-optimization/research-tools, 성능 최적화 안의 CPU & SIMD·메모리 & 파일 I/O·직렬화 & 전송 탭은 research-cpu/research-memory/research-serialization, 도구 & AI 접목 탭의 오픈웨이트 모델 챗봇 구조 실험 카드는 research-chatbot-architecture, 연구 연도는 research-2011/research-2022/research-2023/research-2024/research-2025/research-2026, 기록은 log입니다. research-2011은 학창 시절로 표시됩니다. 번호 없는 SI 활용 단계 소개는 si-levels이며 사용자가 명시한 01~05단계만 si-level-chat/si-level-read-only/si-level-implementation/si-level-tools/si-level-orchestration으로 이동합니다. 사례는 si-tools-ffmpeg/si-session-messaging입니다. SI 실험 소개는 agent-experiments, 7분류는 agent-experiments-*, 공개 개별 실험 소개 카드는 agent-experiment-*입니다. 외부 게임 실행이나 음원 재생은 하지 않습니다. 소개 페이지의 아카이브·협업 프로젝트·개별 항목은 스키마의 past-work-archive, ai-collaboration-projects, archive-*, project-* action으로 이동합니다. 인자는 action 하나뿐이며 year나 target은 받지 않습니다. 펼침·접기는 이 도구의 동작이 아니므로 control_portfolio_research_details를 사용하세요.',
  },
  'control_portfolio_research_details': {
    title: '연구 여정 상세 펼침·접기',
    description: '연구 여정의 상세를 action: expand(펼침) 또는 collapse(접기) 상태로 만듭니다. target은 all(전체), 2011(학창 시절), 2022, 2023, 2024, 2025, 2026 중 하나이며 action과 target을 모두 지정해야 합니다. year는 받지 않습니다. 필요한 연구 페이지와 탭으로 이동하며 토글하지 않고 지정 상태를 적용합니다. 모든 대상 카드의 실제 상태를 확인한 뒤 applied 또는 failed를 반환합니다. 연구 상세 제어 요청에 사용하고, 단순 이동은 control_portfolio_view를 사용하세요.',
  },
  'open_portfolio_settings': {
    title: '포트폴리오 설정 페이지 열기',
    description:
      '포트폴리오의 테마, 포인트 색상, 채팅 레이아웃, 글꼴·글자 크기와 스트리밍 연출을 조정하는 설정 페이지로 이동합니다. 사용자가 설정 페이지를 열어 달라고 요청할 때 사용하세요.',
  },
};

/**
 * 채팅 모델과 같은 이름의 UI 도구를 브라우저 모델 컨텍스트에 등록한다.
 *
 * 등록은 순차적으로 한 개씩 진행하고, 하나가 실패해도 나머지를 계속 등록한다
 * (지원 범위가 브라우저마다 달라 일부만 거부될 수 있다). 언마운트되면
 * AbortController로 남은 등록과 진행 중인 비동기 UI 도구를 함께 취소한다.
 *
 * 화면에 그리는 것은 없다.
 */
export function PortfolioWebMcpTools() {
  const { executePortfolioUiTool } = useChat();

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext || typeof modelContext.registerTool !== 'function') return;

    const controller = new AbortController();
    const executeUiTool = async (
      name: PortfolioUiToolName,
      input: Record<string, unknown>,
    ): Promise<WebMcpToolResult> => {
      try {
        return toolResult(await executePortfolioUiTool({ name, input, signal: controller.signal }));
      } catch (error) {
        return toolError(error);
      }
    };
    /** 스키마와 표현을 합쳐 UI 도구 하나의 등록 정의를 만든다. */
    const uiTool = (name: PortfolioUiToolName): WebMcpTool => {
      const presentation = UI_TOOL_PRESENTATION[name];
      return {
        name,
        title: presentation.title,
        description: presentation.description,
        inputSchema: PORTFOLIO_UI_TOOLS[name].inputSchema,
        ...(presentation.readOnly
          ? { annotations: READ_ONLY_ANNOTATIONS }
          : {}),
        execute(input) {
          return executeUiTool(name, input);
        },
      };
    };
    const tools: WebMcpTool[] = PORTFOLIO_UI_TOOL_NAMES.map(uiTool);

    const registerTools = async () => {
      for (const tool of tools) {
        if (controller.signal.aborted) return;
        try {
          await modelContext.registerTool(tool, { signal: controller.signal });
        } catch (error) {
          if (!controller.signal.aborted && process.env.NODE_ENV !== 'production') {
            console.warn(`WebMCP 도구 등록 실패: ${tool.name}`, error);
          }
        }
      }
    };

    void registerTools();
    return () => controller.abort();
  }, [executePortfolioUiTool]);

  return null;
}

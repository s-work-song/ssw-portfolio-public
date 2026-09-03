'use client';

/**
 * 브라우저의 WebMCP 모델 컨텍스트에 포트폴리오 도구를 등록하는 컴포넌트다.
 *
 * WebMCP를 지원하는 환경에서만 필요하고 도구 설명 문구가 길어서, 지원을
 * 확인한 뒤에만 지연 로딩된다(`PortfolioWebMcp` 게이트가 판단한다).
 *
 * 화면을 바꾸는 도구는 스스로 구현하지 않고 챗봇과 같은 실행기
 * (`executePortfolioUiTool`)에 넘긴다. 허용값·검증·부작용이 한 곳에 모여야
 * 두 경로가 같은 결과를 내기 때문이다. 기록 관련 도구만 공개 API를 직접
 * 호출한다.
 */
import { useEffect } from 'react';
import { useChat } from '@/features/chat';
import {
  findRelatedPortfolioLogs,
  getPortfolioLogOutline,
  resolvePortfolioLogTarget,
} from '@/lib/logApi';
import { preparePortfolioLogSearchView } from './logSearchView';
import {
  PORTFOLIO_UI_TOOLS,
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

/**
 * 비어 있지 않은 문자열 인자를 읽는다. 아니면 TypeError를 던진다.
 *
 * 기록 도구의 slug처럼 곧바로 주소가 되는 값이라 공백만 있는 입력을
 * 그대로 API로 넘기지 않는다.
 */
function textInput(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${key}에는 비어 있지 않은 문자열이 필요합니다.`);
  }
  return value.trim();
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
  'get-portfolio-ui-settings': {
    title: '현재 포트폴리오 UI 설정 확인',
    description:
      '현재 사이트 테마, 포인트 색상, 채팅 레이아웃, 채팅 글꼴과 글자 크기를 읽습니다. 화면을 변경하지 않습니다.',
    readOnly: true,
  },
  'set-portfolio-theme': {
    title: '포트폴리오 화면 모드 변경',
    description:
      '사용자가 명시적으로 요청한 경우 사이트를 라이트 또는 다크 모드로 변경합니다.',
  },
  'set-portfolio-accent': {
    title: '포트폴리오 포인트 색상 변경',
    description:
      '사용자가 명시적으로 요청한 포인트 색상으로 버튼과 강조 요소의 색을 변경합니다. 기본 색상은 indigo입니다.',
  },
  'set-portfolio-chat-layout': {
    title: '포트폴리오 채팅 레이아웃 변경',
    description:
      'PC 채팅창을 플로팅 창 또는 오른쪽 고정 패널로 변경합니다. 좁은 화면에서는 플로팅 창이 적용됩니다.',
  },
  'set-portfolio-chat-font': {
    title: '포트폴리오 채팅 글꼴 변경',
    description:
      '채팅 메시지와 입력창, 추천 질문의 글꼴을 Pretendard, Noto Sans KR 또는 시스템 글꼴로 변경합니다.',
  },
  'set-portfolio-chat-font-size': {
    title: '포트폴리오 채팅 글자 크기 변경',
    description:
      '채팅 메시지와 입력창, 추천 질문의 글자 크기를 작게, 기본, 크게 또는 매우 크게로 변경합니다.',
  },
  'set-portfolio-stream-animation': {
    title: '채팅 스트리밍 연출 변경',
    description:
      '사용자가 명시적으로 요청한 채팅 답변 스트리밍 연출을 변경합니다. 스트리밍 사용 여부 자체는 변경하지 않습니다.',
  },
  'get-portfolio-view-state': {
    title: '현재 포트폴리오 화면 상태 확인',
    description:
      '현재 보고 있는 포트폴리오 페이지와 앵커 위치, 활성 연구 탭, 화면에 가장 많이 보이는 연구 연도 및 연구 상세 펼침 상태를 읽습니다. 화면을 변경하지 않습니다.',
    readOnly: true,
  },
  'control-portfolio-view': {
    title: '포트폴리오 화면 이동 및 연구 상세 제어',
    description:
      '메인·홈 요청은 소개 Overview로 이동하고, 이력서, 자기소개서, 연구 경험의 연구 여정·성능 최적화·도구 & AI 접목 탭, 연구 연도, 기록 화면으로 이동합니다. 소개 페이지 안에서는 과거 작업 아카이브 섹션과 AI 에이전트 협업 프로젝트 섹션, 그리고 개별 항목(Canvas 피하기 게임, 엑셀 행 매핑 WPF 앱, Android AR 캠프파이어 앱, 공용 인프라 프로젝트군, 이커머스 데모, 게임 모음 플랫폼, 코드 아카이브) 위치로도 이동합니다. 연구 여정의 전체 상세 또는 지정한 연도의 상세만 펼치거나 접을 수도 있습니다. 사용자가 화면 이동이나 연구 상세 제어를 명시적으로 요청했을 때 사용하세요.',
  },
  'open-portfolio-settings': {
    title: '포트폴리오 설정 페이지 열기',
    description:
      '포트폴리오의 테마, 포인트 색상, 채팅 레이아웃, 글꼴·글자 크기와 스트리밍 연출을 조정하는 설정 페이지로 이동합니다. 사용자가 설정 페이지를 열어 달라고 요청할 때 사용하세요.',
  },
};

/**
 * 포트폴리오 도구 14종을 브라우저 모델 컨텍스트에 등록한다.
 *
 * 등록은 순차적으로 한 개씩 진행하고, 하나가 실패해도 나머지를 계속 등록한다
 * (지원 범위가 브라우저마다 달라 일부만 거부될 수 있다). 언마운트되면
 * AbortController로 남은 등록과 진행 중인 API 요청을 함께 취소한다.
 *
 * 화면에 그리는 것은 없다.
 */
export function PortfolioWebMcpTools() {
  const { navigateRoute, executePortfolioUiTool } = useChat();

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext || typeof modelContext.registerTool !== 'function') return;

    const controller = new AbortController();
    const executeUiTool = (
      name: PortfolioUiToolName,
      input: Record<string, unknown>,
    ): WebMcpToolResult => {
      try {
        return toolResult(executePortfolioUiTool({ name, input }));
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

    const tools: WebMcpTool[] = [
      uiTool('get-portfolio-ui-settings'),
      uiTool('set-portfolio-theme'),
      uiTool('set-portfolio-accent'),
      uiTool('set-portfolio-chat-layout'),
      uiTool('set-portfolio-chat-font'),
      uiTool('set-portfolio-chat-font-size'),
      {
        name: 'search-portfolio-logs',
        title: '포트폴리오 기록 검색',
        description:
          '공개 포트폴리오 기록의 제목, 요약, 태그, 소제목과 본문을 검색합니다. 기록 목록 화면으로 이동해 적절한 검색어와 태그를 적용하고 후보 목록을 사용자에게 보여줍니다. 특정 글을 열어야 할 때만 결과의 slug와 section id를 open-portfolio-log에 전달하세요.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '찾으려는 기록의 핵심 단어 또는 기억나는 내용',
              maxLength: 200,
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: '모두 일치해야 하는 공개 태그 목록',
              maxItems: 5,
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 10,
              default: 5,
              description: '반환할 최대 후보 수',
            },
          },
          anyOf: [{ required: ['query'] }, { required: ['tags'] }],
        },
        async execute(input) {
          try {
            const result = await preparePortfolioLogSearchView(input, 'webmcp');
            navigateRoute(result.view.route);
            return toolResult({
              ...result,
              message: `기록 목록으로 이동해 ${result.matches.length}개의 검색 결과를 표시했습니다.`,
            });
          } catch (error) {
            return toolError(error);
          }
        },
      },
      {
        name: 'get-portfolio-log-outline',
        title: '포트폴리오 기록 목차 확인',
        description:
          '특정 공개 기록의 제목, 요약, 태그와 소제목별 section id를 반환합니다. 내용을 열기 전에 글의 구성을 확인할 때 사용하세요.',
        inputSchema: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: '검색 결과에 포함된 기록 slug' },
          },
          required: ['slug'],
        },
        annotations: READ_ONLY_ANNOTATIONS,
        async execute(input) {
          try {
            return toolResult(await getPortfolioLogOutline(
              textInput(input, 'slug'),
              controller.signal,
            ));
          } catch (error) {
            return toolError(error);
          }
        },
      },
      {
        name: 'open-portfolio-log',
        title: '포트폴리오 기록 열기',
        description:
          '공개 기록 상세 페이지 또는 검색 결과가 가리킨 소제목으로 이동하고 해당 위치를 강조합니다. search-portfolio-logs가 반환한 slug와 section id를 그대로 사용하세요.',
        inputSchema: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: '검색 결과에 포함된 기록 slug' },
            sectionId: {
              type: 'string',
              description: '선택 사항. 검색 결과 또는 목차에 포함된 section id',
            },
          },
          required: ['slug'],
        },
        async execute(input) {
          try {
            const target = await resolvePortfolioLogTarget(
              textInput(input, 'slug'),
              typeof input.sectionId === 'string' ? input.sectionId : undefined,
              controller.signal,
            );
            navigateRoute(target.route);
            return toolResult({
              ok: true,
              ...target,
              message: target.section
                ? `「${target.title}」의 「${target.section.title}」 위치로 이동을 시작했습니다.`
                : `「${target.title}」 기록으로 이동을 시작했습니다.`,
            });
          } catch (error) {
            return toolError(error);
          }
        },
      },
      {
        name: 'find-related-portfolio-logs',
        title: '연관 포트폴리오 기록 찾기',
        description:
          '선택한 공개 기록과 태그 또는 핵심 단어가 겹치는 다른 기록을 찾습니다. 결과의 공통 태그와 키워드를 보고 관련성을 판단하세요.',
        inputSchema: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: '기준이 되는 기록 slug' },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 10,
              default: 5,
              description: '반환할 최대 후보 수',
            },
          },
          required: ['slug'],
        },
        annotations: READ_ONLY_ANNOTATIONS,
        async execute(input) {
          try {
            return toolResult(await findRelatedPortfolioLogs(
              textInput(input, 'slug'),
              input.limit,
              controller.signal,
            ));
          } catch (error) {
            return toolError(error);
          }
        },
      },
      uiTool('get-portfolio-view-state'),
      uiTool('control-portfolio-view'),
      uiTool('open-portfolio-settings'),
      uiTool('set-portfolio-stream-animation'),
    ];

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
  }, [executePortfolioUiTool, navigateRoute]);

  return null;
}

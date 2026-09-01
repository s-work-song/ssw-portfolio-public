'use client';

import { useEffect } from 'react';
import { useChat } from '@/features/chat';
import { CHAT_STREAM_ANIMATIONS } from '@/features/chat/constants';
import {
  findRelatedPortfolioLogs,
  getPortfolioLogOutline,
  resolvePortfolioLogTarget,
} from '@/lib/logApi';
import {
  PORTFOLIO_MODEL_TOOL_EXECUTION_EVENT,
  preparePortfolioModelToolView,
  preparePortfolioLogSearchView,
  type PortfolioModelToolExecution,
} from './logSearchView';
import {
  PORTFOLIO_VIEW_ACTIONS,
  PORTFOLIO_RESEARCH_YEARS,
} from './portfolioView';
import type { PortfolioUiToolName } from '@/features/portfolio-tools/portfolioUiToolExecutor';

function toolResult(payload: unknown): WebMcpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}

function toolError(error: unknown): WebMcpToolResult {
  return toolResult({
    ok: false,
    error: error instanceof Error ? error.message : 'WebMCP 도구 실행 중 오류가 발생했습니다.',
  });
}

function textInput(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${key}에는 비어 있지 않은 문자열이 필요합니다.`);
  }
  return value.trim();
}

export function PortfolioWebMcp() {
  const { navigateRoute, executePortfolioUiTool } = useChat();

  useEffect(() => {
    const controller = new AbortController();
    const handleModelToolExecution = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<PortfolioModelToolExecution>;
      if (!event.detail || controller.signal.aborted) return;
      void preparePortfolioModelToolView(event.detail)
        .then((result) => {
          if (!controller.signal.aborted) navigateRoute(result.view.route);
        })
        .catch((error) => {
          if (!controller.signal.aborted && process.env.NODE_ENV !== 'production') {
            console.warn('모델 도구 검색 결과를 화면에 표시하지 못했습니다.', error);
          }
        });
    };
    window.addEventListener(
      PORTFOLIO_MODEL_TOOL_EXECUTION_EVENT,
      handleModelToolExecution,
    );
    return () => {
      controller.abort();
      window.removeEventListener(
        PORTFOLIO_MODEL_TOOL_EXECUTION_EVENT,
        handleModelToolExecution,
      );
    };
  }, [navigateRoute]);

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext || typeof modelContext.registerTool !== 'function') return;

    const controller = new AbortController();
    const readOnlyAnnotations = { readOnlyHint: true } as const;
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
    const tools: WebMcpTool[] = [
      {
        name: 'get-portfolio-ui-settings',
        title: '현재 포트폴리오 UI 설정 확인',
        description:
          '현재 사이트 테마, 포인트 색상, 채팅 레이아웃, 채팅 글꼴과 글자 크기를 읽습니다. 화면을 변경하지 않습니다.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: readOnlyAnnotations,
        execute(input) {
          return executeUiTool('get-portfolio-ui-settings', input);
        },
      },
      {
        name: 'set-portfolio-theme',
        title: '포트폴리오 화면 모드 변경',
        description:
          '사용자가 명시적으로 요청한 경우 사이트를 라이트 또는 다크 모드로 변경합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            theme: {
              type: 'string',
              enum: ['light', 'dark'],
              description: 'light 또는 dark 중 하나',
            },
          },
          required: ['theme'],
          additionalProperties: false,
        },
        execute(input) {
          return executeUiTool('set-portfolio-theme', input);
        },
      },
      {
        name: 'set-portfolio-accent',
        title: '포트폴리오 포인트 색상 변경',
        description:
          '사용자가 명시적으로 요청한 포인트 색상으로 버튼과 강조 요소의 색을 변경합니다. 기본 색상은 indigo입니다.',
        inputSchema: {
          type: 'object',
          properties: {
            accent: {
              type: 'string',
              enum: ['indigo', 'emerald', 'amber', 'rose', 'violet'],
              description: '지원하는 포인트 색상',
            },
          },
          required: ['accent'],
          additionalProperties: false,
        },
        execute(input) {
          return executeUiTool('set-portfolio-accent', input);
        },
      },
      {
        name: 'set-portfolio-chat-layout',
        title: '포트폴리오 채팅 레이아웃 변경',
        description:
          'PC 채팅창을 플로팅 창 또는 오른쪽 고정 패널로 변경합니다. 좁은 화면에서는 플로팅 창이 적용됩니다.',
        inputSchema: {
          type: 'object',
          properties: {
            layout: {
              type: 'string',
              enum: ['floating', 'dock'],
              description: 'floating 또는 dock 중 하나',
            },
          },
          required: ['layout'],
          additionalProperties: false,
        },
        execute(input) {
          return executeUiTool('set-portfolio-chat-layout', input);
        },
      },
      {
        name: 'set-portfolio-chat-font',
        title: '포트폴리오 채팅 글꼴 변경',
        description:
          '채팅 메시지와 입력창, 추천 질문의 글꼴을 Pretendard, Noto Sans KR 또는 시스템 글꼴로 변경합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            font: {
              type: 'string',
              enum: ['pretendard', 'noto-sans-kr', 'system'],
              description: '지원하는 채팅 글꼴',
            },
          },
          required: ['font'],
          additionalProperties: false,
        },
        execute(input) {
          return executeUiTool('set-portfolio-chat-font', input);
        },
      },
      {
        name: 'set-portfolio-chat-font-size',
        title: '포트폴리오 채팅 글자 크기 변경',
        description:
          '채팅 메시지와 입력창, 추천 질문의 글자 크기를 작게, 기본, 크게 또는 매우 크게로 변경합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            size: {
              type: 'string',
              enum: ['small', 'medium', 'large', 'xlarge'],
              description: 'small, medium, large, xlarge 중 하나',
            },
          },
          required: ['size'],
          additionalProperties: false,
        },
        execute(input) {
          return executeUiTool('set-portfolio-chat-font-size', input);
        },
      },
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
        annotations: readOnlyAnnotations,
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
        annotations: readOnlyAnnotations,
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
        annotations: readOnlyAnnotations,
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
        annotations: readOnlyAnnotations,
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
      {
        name: 'get-portfolio-view-state',
        title: '현재 포트폴리오 화면 상태 확인',
        description:
          '현재 보고 있는 포트폴리오 페이지와 앵커 위치, 연구 연도 및 연구 상세 펼침 상태를 읽습니다. 화면을 변경하지 않습니다.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: readOnlyAnnotations,
        execute(input) {
          return executeUiTool('get-portfolio-view-state', input);
        },
      },
      {
        name: 'control-portfolio-view',
        title: '포트폴리오 화면 이동 및 연구 상세 제어',
        description:
          '메인·홈 요청은 소개 Overview로 이동하고, 이력서, 자기소개서, 연구 경험, 연구 연도, 기록 화면으로 이동합니다. 연구 여정의 전체 상세 또는 지정한 연도의 상세만 펼치거나 접을 수도 있습니다. 사용자가 화면 이동이나 연구 상세 제어를 명시적으로 요청했을 때 사용하세요.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: PORTFOLIO_VIEW_ACTIONS,
              description:
                '화면 이동, 전체 연구 상세 제어 또는 연도별 연구 상세 제어 동작',
            },
            year: {
              type: 'string',
              enum: PORTFOLIO_RESEARCH_YEARS,
              description:
                'expand-research-year-details 또는 collapse-research-year-details일 때 반드시 지정할 연구 연도',
            },
          },
          required: ['action'],
          additionalProperties: false,
        },
        execute(input) {
          return executeUiTool('control-portfolio-view', input);
        },
      },
      {
        name: 'open-portfolio-settings',
        title: '포트폴리오 설정 페이지 열기',
        description:
          '포트폴리오의 테마, 포인트 색상, 채팅 레이아웃, 글꼴·글자 크기와 스트리밍 연출을 조정하는 설정 페이지로 이동합니다. 사용자가 설정 페이지를 열어 달라고 요청할 때 사용하세요.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        execute(input) {
          return executeUiTool('open-portfolio-settings', input);
        },
      },
      {
        name: 'set-portfolio-stream-animation',
        title: '채팅 스트리밍 연출 변경',
        description:
          '사용자가 명시적으로 요청한 채팅 답변 스트리밍 연출을 변경합니다. 스트리밍 사용 여부 자체는 변경하지 않습니다.',
        inputSchema: {
          type: 'object',
          properties: {
            animation: {
              type: 'string',
              enum: CHAT_STREAM_ANIMATIONS,
              description:
                'none, typewriter, word-fade, token-chunks, blur-focus, slide-up, skeleton, mask-wipe, scramble, letter-drop, highlight-trail 중 하나',
            },
          },
          required: ['animation'],
          additionalProperties: false,
        },
        execute(input) {
          return executeUiTool('set-portfolio-stream-animation', input);
        },
      },
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

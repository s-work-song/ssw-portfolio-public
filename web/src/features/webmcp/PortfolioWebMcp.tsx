'use client';

import { useEffect } from 'react';
import { useChat } from '@/features/chat';
import {
  findRelatedPortfolioLogs,
  getPortfolioLogOutline,
  resolvePortfolioLogTarget,
} from './logTools.mjs';
import {
  loadPortfolioLogIndex,
  preparePortfolioLogSearchView,
} from './logSearchView';

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
  const { navigateRoute } = useChat();

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext || typeof modelContext.registerTool !== 'function') return;

    const controller = new AbortController();
    const readOnlyAnnotations = { readOnlyHint: true } as const;
    const tools: WebMcpTool[] = [
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
            return toolResult(getPortfolioLogOutline(await loadPortfolioLogIndex(), textInput(input, 'slug')));
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
            const target = resolvePortfolioLogTarget(
              await loadPortfolioLogIndex(),
              textInput(input, 'slug'),
              typeof input.sectionId === 'string' ? input.sectionId : undefined,
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
            return toolResult(findRelatedPortfolioLogs(
              await loadPortfolioLogIndex(),
              textInput(input, 'slug'),
              input,
            ));
          } catch (error) {
            return toolError(error);
          }
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
  }, [navigateRoute]);

  return null;
}

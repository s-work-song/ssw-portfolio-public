import { ToolDefinition, type InputDefinition, type JsonObjectSchema } from './contract.ts';

type LogOutlineInput = { slug: string };
type OpenLogInput = { slug: string; sectionId?: string };

function requiredSlugInput(schema: JsonObjectSchema): InputDefinition<LogOutlineInput> {
  return {
    schema,
    parse(input) {
      const slug = textInput(input, 'slug');
      return { slug };
    },
  };
}

function openLogInput(schema: JsonObjectSchema): InputDefinition<OpenLogInput> {
  return {
    schema,
    parse(input) {
      const slug = textInput(input, 'slug');
      return typeof input.sectionId === 'string' ? { slug, sectionId: input.sectionId } : { slug };
    },
  };
}

function textInput(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${key}에는 비어 있지 않은 문자열이 필요합니다.`);
  }
  return value.trim();
}

export const GET_PORTFOLIO_LOG_OUTLINE_TOOL = new ToolDefinition(
  'get_portfolio_log_outline',
  requiredSlugInput({
    type: 'object',
    properties: { slug: { type: 'string', description: '검색 결과에 포함된 기록 slug' } },
    required: ['slug'],
  }),
);
export const OPEN_PORTFOLIO_LOG_TOOL = new ToolDefinition(
  'open_portfolio_log',
  openLogInput({
    type: 'object',
    properties: {
      slug: { type: 'string', description: '검색 결과에 포함된 기록 slug' },
      sectionId: { type: 'string', description: '선택 사항. 검색 결과 또는 목차에 포함된 section id' },
    },
    required: ['slug'],
  }),
);
export const PORTFOLIO_LOG_TOOL_DEFINITIONS = [
  GET_PORTFOLIO_LOG_OUTLINE_TOOL,
  OPEN_PORTFOLIO_LOG_TOOL,
] as const;

export type PortfolioLogToolName = (typeof PORTFOLIO_LOG_TOOL_DEFINITIONS)[number]['name'];

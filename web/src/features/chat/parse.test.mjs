// 챗봇 응답 파서(`parse.ts`)의 계약을 브라우저 없이 검증한다.
// Node가 타입을 지우고 TypeScript 원본을 그대로 실행하므로 별도 빌드가 없다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ChatApiError,
  nextSseBlock,
  parseAction,
  parseChatResponse,
  parsePortfolioViewState,
  parseSegment,
  parseSseBlock,
  parseSuggestedQuestions,
  parseToolExecution,
  parseToolExecutions,
  retryAfterMsFromHeader,
} from './parse.ts';
import { ACTION_LABELS } from './constants.ts';
import { PORTFOLIO_VIEW_ACTIONS } from '../portfolio-tools/schema.ts';

/** 형식은 통과하되 본문만 바꿔 쓰는 최소 응답 골격이다. */
function chatResponse(overrides = {}) {
  return {
    mode: 'model',
    status: 'online',
    generated: true,
    answer: '안녕하세요.',
    segments: [],
    audience: 'default',
    tone: 'official',
    pageContext: 'default',
    actions: [],
    suggestedQuestions: [],
    toolExecutions: [],
    cached: false,
    ...overrides,
  };
}

/** 도구 실행 payload의 공통 부분이다. */
function execution(type, toolName, rest = {}) {
  return { type, toolName, toolCallId: 'call-1', ...rest };
}

test('SSE: 주석(keep-alive) 줄만 있는 블록은 디스패치하지 않는다', () => {
  assert.equal(parseSseBlock(': keep-alive'), null);
  assert.equal(parseSseBlock(':\n: ping'), null);
});

test('SSE: event 필드가 없는 블록은 무시한다', () => {
  assert.equal(parseSseBlock('data: {"text":"안녕"}'), null);
});

test('SSE: data 없이 event만 있는 블록도 무시한다', () => {
  assert.equal(parseSseBlock('event: delta'), null);
});

test('SSE: event와 data가 모두 있으면 값 앞 공백 하나만 제거한다', () => {
  assert.deepEqual(parseSseBlock('event: delta\ndata:  두 칸'), {
    event: 'delta',
    data: ' 두 칸',
  });
});

test('SSE: 여러 data 줄은 줄바꿈으로 이어 붙인다', () => {
  assert.deepEqual(parseSseBlock('event: done\ndata: {"a":1,\ndata: "b":2}'), {
    event: 'done',
    data: '{"a":1,\n"b":2}',
  });
});

test('SSE: CRLF 구분자와 BOM이 섞여도 같은 결과를 낸다', () => {
  assert.deepEqual(parseSseBlock('\uFEFFevent: meta\r\ndata: {}'), {
    event: 'meta',
    data: '{}',
  });
});

test('SSE: 청크 경계에서 잘린 블록은 다음 청크와 이어 붙는다', () => {
  // 첫 청크에는 블록 구분자(빈 줄)가 없어 아직 떼어낼 수 없다.
  assert.equal(nextSseBlock('event: delta\ndata: {"text":"안'), null);

  const buffer = 'event: delta\ndata: {"text":"안녕"}\n\nevent: done\n';
  const first = nextSseBlock(buffer);
  assert.deepEqual(parseSseBlock(first.block), {
    event: 'delta',
    data: '{"text":"안녕"}',
  });
  // 남은 조각은 아직 완결되지 않았으므로 버퍼에 그대로 남는다.
  assert.equal(first.rest, 'event: done\n');
  assert.equal(nextSseBlock(first.rest), null);
});

test('응답: 본문과 문단이 모두 비면 empty_answer로 실패한다', () => {
  assert.throws(
    () => parseChatResponse(chatResponse({ answer: '   ', segments: [] })),
    (error) => error instanceof ChatApiError && error.code === 'empty_answer',
  );
});

test('응답: 본문이 비어도 문단이 남아 있으면 통과한다', () => {
  const parsed = parseChatResponse(
    chatResponse({
      answer: '',
      segments: [{ markdown: '문단', actions: [] }],
    }),
  );
  assert.equal(parsed.segments.length, 1);
});

test('응답: mode와 generated 조합이 어긋나면 거부한다', () => {
  assert.throws(
    () => parseChatResponse(chatResponse({ mode: 'retrieval_fallback' })),
    ChatApiError,
  );
});

test('응답: 허용 목록 밖 tone·pageContext는 거부한다', () => {
  assert.throws(() => parseChatResponse(chatResponse({ tone: 'pirate' })), ChatApiError);
  assert.throws(
    () => parseChatResponse(chatResponse({ pageContext: 'admin' })),
    ChatApiError,
  );
});

test('액션: 라벨이 프런트 정의와 다르면 버린다', () => {
  assert.deepEqual(parseAction({ id: 'resume', label: ACTION_LABELS.resume }), {
    id: 'resume',
    label: ACTION_LABELS.resume,
  });
  assert.equal(parseAction({ id: 'resume', label: '아무 문구' }), null);
  assert.equal(parseAction({ id: 'unknown', label: '경력·기술 보기' }), null);
});

test('문단: 액션은 두 개까지만 남는다', () => {
  const segment = parseSegment({
    markdown: '본문',
    actions: [
      { id: 'resume', label: ACTION_LABELS.resume },
      { id: 'research', label: ACTION_LABELS.research },
      { id: 'log', label: ACTION_LABELS.log },
    ],
  });
  assert.equal(segment.actions.length, 2);
});

test('추천 질문: 길이·중복을 거르고 최대 네 개만 남긴다', () => {
  const questions = parseSuggestedQuestions([
    '짧음',
    '충분히 긴 질문입니다',
    '충분히 긴 질문입니다',
    '두 번째 질문입니다',
    '세 번째 질문입니다',
    '네 번째 질문입니다',
    '다섯 번째 질문입니다',
    123,
  ]);
  assert.equal(questions.length, 4);
  assert.equal(questions[0], '충분히 긴 질문입니다');
});

test('retry-after: 없거나 이상하면 기본 10초, 아주 크면 5분에서 자른다', () => {
  assert.equal(retryAfterMsFromHeader(null), 10_000);
  assert.equal(retryAfterMsFromHeader('  '), 10_000);
  assert.equal(retryAfterMsFromHeader('nope'), 10_000);
  assert.equal(retryAfterMsFromHeader('0'), 10_000);
  assert.equal(retryAfterMsFromHeader('-3'), 10_000);
  assert.equal(retryAfterMsFromHeader('7'), 7_000);
  assert.equal(retryAfterMsFromHeader('99999'), 300_000);
});

test('도구: 화면 모드 변경을 파싱하고 목록 밖 값은 거부한다', () => {
  assert.deepEqual(
    parseToolExecution(
      execution('set_portfolio_theme', 'set-portfolio-theme', { theme: 'dark' }),
    ),
    {
      type: 'set_portfolio_theme',
      toolCallId: 'call-1',
      toolName: 'set-portfolio-theme',
      theme: 'dark',
    },
  );
  assert.equal(
    parseToolExecution(
      execution('set_portfolio_theme', 'set-portfolio-theme', {
        theme: 'system',
      }),
    ),
    null,
  );
});

test('도구: 포인트 색상은 허용 목록 안에서만 통과한다', () => {
  assert.equal(
    parseToolExecution(
      execution('set_portfolio_accent', 'set-portfolio-accent', {
        accent: 'violet',
      }),
    ).accent,
    'violet',
  );
  assert.equal(
    parseToolExecution(
      execution('set_portfolio_accent', 'set-portfolio-accent', {
        accent: 'neon',
      }),
    ),
    null,
  );
});

test('도구: 색상 순회는 다섯 색이 모두 한 번씩, 간격이 범위 안일 때만 통과한다', () => {
  const accents = ['indigo', 'emerald', 'amber', 'rose', 'violet'];
  assert.equal(
    parseToolExecution(
      execution('cycle_portfolio_accent', 'cycle-portfolio-accent', {
        accents,
        stepMs: 300,
      }),
    ).stepMs,
    300,
  );
  assert.equal(
    parseToolExecution(
      execution('cycle_portfolio_accent', 'cycle-portfolio-accent', {
        accents: ['indigo', 'indigo', 'amber', 'rose', 'violet'],
        stepMs: 300,
      }),
    ),
    null,
  );
  assert.equal(
    parseToolExecution(
      execution('cycle_portfolio_accent', 'cycle-portfolio-accent', {
        accents,
        stepMs: 50,
      }),
    ),
    null,
  );
});

test('도구: 화면 제어는 연도 인자 규칙까지 확인한다', () => {
  assert.equal(
    parseToolExecution(
      execution('control_portfolio_view', 'control-portfolio-view', {
        action: 'resume',
      }),
    ).action,
    'resume',
  );
  // 연도별 상세 제어에는 연도가 반드시 있어야 한다.
  assert.equal(
    parseToolExecution(
      execution('control_portfolio_view', 'control-portfolio-view', {
        action: 'expand-research-year-details',
      }),
    ),
    null,
  );
  assert.equal(
    parseToolExecution(
      execution('control_portfolio_view', 'control-portfolio-view', {
        action: 'expand-research-year-details',
        year: '2024',
      }),
    ).year,
    '2024',
  );
  // 연도를 요구하지 않는 동작에 연도를 붙이면 거부한다.
  assert.equal(
    parseToolExecution(
      execution('control_portfolio_view', 'control-portfolio-view', {
        action: 'resume',
        year: '2024',
      }),
    ),
    null,
  );
  // 목록에 없는 연도와 동작도 거부한다.
  assert.equal(
    parseToolExecution(
      execution('control_portfolio_view', 'control-portfolio-view', {
        action: 'expand-research-year-details',
        year: '1999',
      }),
    ),
    null,
  );
  assert.equal(
    parseToolExecution(
      execution('control_portfolio_view', 'control-portfolio-view', {
        action: 'delete-everything',
      }),
    ),
    null,
  );
});

test('도구: 소개 페이지 안의 이동 목적지도 허용 목록에 들어 있다', () => {
  // 서버 목록(비공개 backend/src/shared/view-targets.js)과 수동으로 맞추는
  // 값이라, 개수가 달라지면 한쪽만 고친 것이다.
  assert.equal(PORTFOLIO_VIEW_ACTIONS.length, 27);
  assert.equal(
    parseToolExecution(
      execution('control_portfolio_view', 'control-portfolio-view', {
        action: 'past-work-archive',
      }),
    ).action,
    'past-work-archive',
  );
  assert.equal(
    parseToolExecution(
      execution('control_portfolio_view', 'control-portfolio-view', {
        action: 'project-ecommerce-demo',
      }),
    ).action,
    'project-ecommerce-demo',
  );
  // 새 목적지도 연도 인자를 받지 않는다.
  assert.equal(
    parseToolExecution(
      execution('control_portfolio_view', 'control-portfolio-view', {
        action: 'ai-collaboration-projects',
        year: '2024',
      }),
    ),
    null,
  );
});

test('응답: uiToolOutcome은 아는 값만 남기고 나머지는 무시한다', () => {
  assert.equal(
    parseChatResponse(chatResponse({ uiToolOutcome: 'not_called' }))
      .uiToolOutcome,
    'not_called',
  );
  assert.equal(
    parseChatResponse(chatResponse({ uiToolOutcome: 'sometimes' }))
      .uiToolOutcome,
    undefined,
  );
  // 필드를 보내지 않는 옛 서버 응답도 그대로 통과한다.
  assert.equal(parseChatResponse(chatResponse()).uiToolOutcome, undefined);
});

test('도구: 채팅 글꼴과 글자 크기는 허용 목록 안에서만 통과한다', () => {
  assert.equal(
    parseToolExecution(
      execution('set_portfolio_chat_font', 'set-portfolio-chat-font', {
        font: 'noto-sans-kr',
      }),
    ).font,
    'noto-sans-kr',
  );
  assert.equal(
    parseToolExecution(
      execution('set_portfolio_chat_font', 'set-portfolio-chat-font', {
        font: 'comic-sans',
      }),
    ),
    null,
  );
  assert.equal(
    parseToolExecution(
      execution(
        'set_portfolio_chat_font_size',
        'set-portfolio-chat-font-size',
        { size: 'xlarge' },
      ),
    ).size,
    'xlarge',
  );
  assert.equal(
    parseToolExecution(
      execution(
        'set_portfolio_chat_font_size',
        'set-portfolio-chat-font-size',
        { size: 'huge' },
      ),
    ),
    null,
  );
});

test('도구: 스트리밍 연출은 허용 목록 안에서만 통과한다', () => {
  assert.equal(
    parseToolExecution(
      execution(
        'set_portfolio_stream_animation',
        'set-portfolio-stream-animation',
        { animation: 'scramble' },
      ),
    ).animation,
    'scramble',
  );
  assert.equal(
    parseToolExecution(
      execution(
        'set_portfolio_stream_animation',
        'set-portfolio-stream-animation',
        { animation: 'explode' },
      ),
    ),
    null,
  );
});

test('도구: 기록 검색 결과는 slug 형태를 좁히고 다섯 개까지만 남긴다', () => {
  const parsed = parseToolExecution(
    execution('show_portfolio_log_results', 'search-portfolio-logs', {
      query: 'AI 협업',
      matchedSlugs: [
        'first-log',
        'first-log',
        '../../etc/passwd',
        'Second-Log',
        'a',
        'b',
        'c',
        'd',
        'e',
        'f',
      ],
    }),
  );
  assert.deepEqual(parsed.matchedSlugs, ['first-log', 'a', 'b', 'c', 'd']);
});

test('도구: toolName이 어긋나거나 toolCallId가 없으면 거부한다', () => {
  assert.equal(
    parseToolExecution(
      execution('set_portfolio_theme', 'set-portfolio-accent', {
        theme: 'dark',
      }),
    ),
    null,
  );
  assert.equal(
    parseToolExecution({
      type: 'set_portfolio_theme',
      toolName: 'set-portfolio-theme',
      theme: 'dark',
    }),
    null,
  );
  assert.equal(
    parseToolExecution({
      type: 'set_portfolio_theme',
      toolName: 'set-portfolio-theme',
      toolCallId: 'x'.repeat(129),
      theme: 'dark',
    }),
    null,
  );
  assert.equal(parseToolExecution({ type: 'unknown_tool' }), null);
});

test('도구 목록: 실패한 항목만 버리고 최대 여덟 개까지 적용한다', () => {
  const valid = () =>
    execution('set_portfolio_theme', 'set-portfolio-theme', { theme: 'dark' });
  const values = [
    ...Array.from({ length: 10 }, () => valid()),
    { type: 'set_portfolio_theme', toolName: 'set-portfolio-theme' },
  ];
  assert.equal(parseToolExecutions(values).length, 8);
  assert.deepEqual(parseToolExecutions('배열이 아님'), []);
});

test('화면 상태: 허용 목록 밖 값이 섞이면 통째로 버린다', () => {
  const base = {
    page: 'research',
    anchor: 'research-timeline',
    researchTab: 'timeline',
    researchYear: '2025',
    researchDetails: { expanded: 1, total: 3, expandedYears: ['2025'] },
  };
  assert.deepEqual(parsePortfolioViewState(base), base);
  assert.equal(parsePortfolioViewState({ ...base, page: 'admin' }), null);
  assert.equal(parsePortfolioViewState({ ...base, researchTab: 'gpu' }), null);
  assert.equal(
    parsePortfolioViewState({
      ...base,
      researchDetails: { expanded: 1, total: 3, expandedYears: ['1999'] },
    }),
    null,
  );
  // 펼친 수가 전체 수보다 많을 수는 없다.
  assert.equal(
    parsePortfolioViewState({
      ...base,
      researchDetails: { expanded: 5, total: 3, expandedYears: [] },
    }),
    null,
  );
});

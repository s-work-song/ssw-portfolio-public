import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  trainingDataFormats,
  trainingExamples,
  trainingExamplesDescription,
  trainingFormatChoice,
  trainingLineParts,
  trainingLineSkeleton,
  trainingLossNote,
} from '../../../../src/features/research/data/trainingData.ts';

const cardsUrl = new URL('../../../../src/features/research/ui/TrainingDataCards.tsx', import.meta.url);
const cssUrl = new URL('../../../../src/features/research/ui/TrainingDataCards.module.css', import.meta.url);

test('학습 데이터 형식은 대표 형식을 나열한 뒤 이 챗봇이 쓴 Conversational 형식 하나를 마지막에 표시한다', () => {
  assert.deepEqual(trainingDataFormats.map(({ id }) => id), ['alpaca', 'prompt-completion', 'sharegpt', 'preference', 'conversational']);
  assert.deepEqual(trainingDataFormats.filter(({ used }) => used).map(({ id }) => id), ['conversational']);
  const [alpaca, , sharegpt, preference, conversational] = trainingDataFormats;
  assert.deepEqual(Object.keys(alpaca.shape), ['instruction', 'input', 'output']);
  assert.deepEqual(Object.keys(sharegpt.shape), ['conversations']);
  assert.deepEqual(Object.keys(conversational.shape), ['messages', 'tools']);
  assert.deepEqual(Object.keys(preference.shape), ['prompt', 'chosen', 'rejected']);
  assert.match(conversational.desc, /OpenAI 채팅 규격/u);
  assert.match(conversational.desc, /TRL에서는 conversational 형식/u);
  assert.match(preference.desc, /지도 미세조정\(SFT\)과는 학습 방식이 다릅니다/u);
  assert.equal(trainingFormatChoice.title, '이 형식으로 학습한 이유');
  assert.equal(trainingFormatChoice.reasons.length, 2);
  assert.match(trainingFormatChoice.reasons.join(' '), /도구 호출과 결과를 대화 순서대로/u);
});

test('학습 파일 한 줄은 실제 줄과 같은 메시지 순서로 줄여 보이고, 생략한 부분과 정답 범위를 밝힌다', () => {
  const { messages, tools } = trainingLineSkeleton;
  assert.deepEqual(messages.map(({ role }) => role), ['system', 'user', 'assistant', 'tool', 'assistant']);
  const [system, user, call, result, answer] = messages;
  assert.match(system.content, /간결 지침 1,625자/u);
  // 간결 지침으로 만든 줄에는 방문자 메시지 끝의 검색 상기 문구가 붙지 않는다.
  assert.equal(user.content, '연구 경험 한 줄 요약해줘');
  // 실제 줄처럼 호출 인자는 JSON 문자열이고, 결과는 같은 호출 ID로 이어진다.
  const [toolCall] = call.tool_calls;
  assert.equal(typeof toolCall.function.arguments, 'string');
  assert.deepEqual(JSON.parse(toolCall.function.arguments), trainingExamples[0].steps[0].call.arguments);
  assert.equal(toolCall.function.name, trainingExamples[0].steps[0].call.name);
  assert.equal(result.tool_call_id, toolCall.id);
  assert.ok(trainingExamples[0].answer.startsWith(answer.content.split(', …')[0]));
  for (const name of ['search_portfolio', 'site_task', 'get_current_datetime']) assert.match(tools[0], new RegExp(name, 'u'));

  assert.deepEqual(trainingLineParts.map(({ label }) => label), ['시스템 지침', '도구 정의', '호출 ID', '앞선 대화', '도구 결과 전체', '인자 표기']);
  const parts = Object.fromEntries(trainingLineParts.map(({ label, desc }) => [label, desc]));
  assert.match(parts['시스템 지침'], /지금 쓰는 메인 LoRA는 간결 지침\(1,625자\)으로 만든 학습 데이터로 학습/u);
  assert.doesNotMatch(JSON.stringify({ trainingLineParts, trainingLossNote }), /1차|2차|3차/u, '회차 이력은 카드에 쓰지 않는다');
  assert.match(parts['도구 정의'], /학습 정답에는 들어가지 않습니다/u);
  assert.match(parts['앞선 대화'], /정답에서 뺍니다\(weight 0\)/u);
  assert.match(trainingLossNote, /마지막 턴의 assistant 메시지/u);
  assert.match(trainingLossNote, /335줄이 667행/u);
});

test('학습 데이터 예시는 메인 세션의 질문·호출·결과·답변으로 된 두 예시만 표시한다', async () => {
  assert.deepEqual(trainingExamples.map(({ title, question, steps }) => ({ title, question, calls: steps.map(({ call }) => call) })), [
    { title: '일반 질문 · 검색 후 답변', question: '연구 경험 한 줄 요약해줘',
      calls: [{ name: 'search_portfolio', arguments: { query: '연구 경험 요약' } }] },
    { title: '화면 조작 요청 · 작업 세션 위임', question: '작년 연구로 가고 다크 모드로 바꿔줘',
      calls: [{ name: 'site_task', arguments: { instruction: '작년 연구로 이동하고 다크 모드로 바꿔 줘' } }] },
  ]);
  const [general, screen] = trainingExamples;
  assert.equal(general.steps[0].result.ok, true);
  assert.ok(general.steps[0].result.results.every(({ section, content }) => section && content));
  // 작업 세션이 실제로 부른 화면 도구는 채팅 도구 계약을 통과해야 한다. 서버 시계는 브라우저 도구가 아니다.
  const { PORTFOLIO_CHAT_TOOLS } = await import('../../../../src/features/portfolio-tools/schema.ts');
  const delegated = screen.steps[0].result;
  assert.equal(delegated.status, 'completed');
  for (const action of delegated.actions) {
    assert.equal(action.ok, true);
    if (action.tool === 'get_current_datetime') continue;
    assert.doesNotThrow(() => PORTFOLIO_CHAT_TOOLS[action.tool].parse(action.arguments), action.tool);
  }
  for (const item of trainingExamples) {
    assert.deepEqual(Object.keys(item).filter((key) => key !== 'note').sort(), ['answer', 'id', 'intent', 'question', 'steps', 'title']);
    assert.match(item.answer, /니다\.$/u);
  }
  // 상대 날짜 예시는 기록 시점을 강조 문장으로 밝히고, 서버 시계 결과도 같은 연도를 보여 준다.
  assert.equal(screen.note, '이 예시는 2026년 기준이라 2025년입니다.');
  assert.deepEqual(delegated.actions[0].observed, { year: 2026, relativeYears: { 작년: 2025 } });
  assert.equal(general.note, undefined);
  assert.match(trainingExamplesDescription, /방문자 대화 기록이 아니며/u);
  assert.match(trainingExamplesDescription, /시스템 지침·도구 정의·호출 ID 등은 생략/u);
  assert.match(trainingExamplesDescription, /실행 결과가 아닌 학습용 정답/u);
  assert.match(trainingExamplesDescription, /도구 결과는 정답이 아닌 입력/u);
  assert.doesNotMatch(JSON.stringify(trainingExamples), /주십시오|소개용|재구성|실제 학습에 사용한|tool_call_id/u);
});

test('학습 데이터 콘텐츠에는 주소·로컬 경로·비밀 값이 없다', () => {
  const text = JSON.stringify([trainingDataFormats, trainingFormatChoice, trainingLineSkeleton, trainingLineParts, trainingLossNote, trainingExamples]);
  assert.doesNotMatch(text, /https?:\/\/|localhost|127\.0\.0\.1|[A-Z]:[\\/]|native94|sourceFile|apiKey|Bearer|송상운/u);
});

test('학습 데이터 카드 세 장은 연구 카드 모양으로 이동 앵커와 AI 질문을 갖춘다', async () => {
  const cards = await readFile(cardsUrl, 'utf8');
  for (const anchor of ['research-training-data', 'research-training-line', 'research-training-examples']) {
    assert.match(cards, new RegExp(`<section id="${anchor}" tabIndex=\\{-1\\} className=\\{styles\\.card\\} aria-labelledby="${anchor}-title">`, 'u'), anchor);
  }
  for (const title of ['학습 데이터 형식', '학습 파일 한 줄의 구성', '학습 데이터 예시']) {
    assert.ok(cards.includes(`title="${title}"`), title);
    assert.ok(cards.includes(`「${title}」`), `AI 질문: ${title}`);
  }
  assert.match(cards, /<code>\{trainingTranscript\(example\)\}<\/code>/u);
  assert.match(cards, /호출\$\{order\} · 정답/u);
  assert.match(cards, /결과\$\{order\} · 입력/u);
  assert.match(cards, /JSON\.stringify\(value, null, 2\)/u);
  assert.doesNotMatch(cards, /dangerouslySetInnerHTML/u);
});

test('학습 예시의 질문·도구 호출·답변·설명은 두 열에서 줄바꿈과 무관하게 고정 높이를 유지한다', async () => {
  const cards = await readFile(cardsUrl, 'utf8');
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /\.trainingGrid\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/u);
  assert.match(css, /@media \(max-width: 860px\)\s*\{\s*\.trainingGrid\s*\{[^}]*grid-template-columns: 1fr;/u);
  assert.match(css, /@media \(max-width: 860px\)[\s\S]*\.trainingOutput,[\s\S]*block-size: auto;/u);
  for (const name of ['trainingRequest', 'trainingOutput', 'trainingReport', 'trainingIntent']) {
    assert.ok(cards.includes(`className={styles.${name}}`));
    assert.match(css, new RegExp(`\\.${name}\\s*\\{[^}]*block-size:\\s*[\\d.]+(?:em|rem);`, 'u'));
  }
  assert.match(css, /\.trainingExample pre\s*\{[^}]*block-size: 100%;/u);
  assert.match(cards, /<pre tabIndex=\{0\} aria-label=/u);
  assert.doesNotMatch(css, /line-clamp|text-overflow:\s*ellipsis/u);
});

test('JSON 칸은 읽기 쉬운 글꼴로 확대하고 긴 줄도 카드 안에서 줄바꿈한다', async () => {
  const css = await readFile(cssUrl, 'utf8');
  const pre = css.match(/\.card pre\s*\{([^}]*)\}/u)?.[1];
  assert.ok(pre);
  for (const rule of ['font-size: 0.85rem !important;', 'white-space: pre-wrap !important;', 'word-break: normal;', 'overflow-wrap: anywhere;', 'max-inline-size: 100%;', 'overflow: auto;']) {
    assert.ok(pre.includes(rule), rule);
  }
  assert.match(css, /\.trainingExample pre\s*\{[^}]*padding: 12px 6px;/u);
  assert.match(css, /\.card code\s*\{[^}]*font-size: inherit !important;/u);
});

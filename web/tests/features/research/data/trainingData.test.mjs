import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  trainingDataFormats,
  trainingExamples,
  trainingFormatChoice,
  trainingLineParts,
  trainingLineSkeleton,
  trainingLossNote,
} from '../../../../src/features/research/data/trainingData.ts';

const cardsUrl = new URL('../../../../src/features/research/ui/TrainingDataCards.tsx', import.meta.url);

test('학습 데이터 형식은 id가 겹치지 않고 카드가 쓰는 필드를 갖춘다', () => {
  assert.equal(new Set(trainingDataFormats.map(({ id }) => id)).size, trainingDataFormats.length);
  for (const format of trainingDataFormats) assert.ok(format.name && format.desc && format.shape, format.id);
  assert.ok(trainingDataFormats.some(({ used }) => used), '카드가 강조할 사용 형식이 있다');
});

test('학습 파일 한 줄은 실제 줄과 같은 메시지 순서이고 호출과 결과가 같은 호출 ID로 이어진다', () => {
  const { messages, tools } = trainingLineSkeleton;
  assert.deepEqual(messages.map(({ role }) => role), ['system', 'user', 'assistant', 'tool', 'assistant']);
  const [, , call, result] = messages;
  // 실제 줄처럼 호출 인자는 JSON 문자열이고, 결과는 같은 호출 ID로 이어진다.
  const [toolCall] = call.tool_calls;
  assert.equal(typeof toolCall.function.arguments, 'string');
  assert.doesNotThrow(() => JSON.parse(toolCall.function.arguments));
  assert.equal(result.tool_call_id, toolCall.id);
  for (const name of ['search_portfolio', 'site_task', 'get_current_datetime']) assert.match(tools[0], new RegExp(name, 'u'));
});

test('학습 데이터 예시는 카드가 쓰는 필드를 갖추고 화면 도구 호출은 채팅 도구 계약을 통과한다', async () => {
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
  }
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
  assert.match(cards, /<code>\{trainingTranscript\(example\)\}<\/code>/u);
  assert.match(cards, /JSON\.stringify\(value, null, 2\)/u);
  assert.doesNotMatch(cards, /dangerouslySetInnerHTML/u);
});

test('학습 예시의 스크롤 가능한 JSON 칸은 키보드로 초점을 받는다', async () => {
  const cards = await readFile(cardsUrl, 'utf8');
  for (const name of ['trainingRequest', 'trainingOutput', 'trainingReport', 'trainingIntent']) {
    assert.ok(cards.includes(`className={styles.${name}}`));
  }
  assert.match(cards, /<pre tabIndex=\{0\} aria-label=/u);
});

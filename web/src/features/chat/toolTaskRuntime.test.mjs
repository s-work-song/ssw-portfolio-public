import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as chatParse from './parse.ts';
import {
  assertToolTaskMeta, expectedToolTaskScope, parseTaskToolExecution,
  parseToolTaskResponse, parseToolTaskSteps, stepFromExecution, ToolTaskProtocolError, ToolTaskRuntime,
} from './toolTaskRuntime.ts';
import { createChatToolTask, nextChatToolTaskGeneration } from './chatRequestIdentity.ts';
import { requestVerifiedToolResponse } from './toolVerificationRequest.ts';
import { toolTaskStepText, toolTaskSummary } from './toolTaskPresentation.ts';
import { BrowserToolTaskTelemetry, isSafeBrowserToolTaskEvents } from './toolTaskTelemetry.ts';
import { failedChatMessage } from './chatFailure.ts';
import { chatRetryFailureKind } from './chatRetryRecovery.ts';

const scope = { schemaVersion: 'portfolio-tool-task-v1', conversationId: 'conversation-1',
  turnId: 'turn-1', taskId: 'task-1', generation: 1 };
const request = (extra = {}) => ({ conversationId: scope.conversationId, turnId: scope.turnId,
  toolTask: { schemaVersion: scope.schemaVersion, taskId: scope.taskId, generation: scope.generation },
  message: '다크 모드', history: [], audience: 'default', tone: 'official', pageContext: 'default', ...extra });
const execution = (index = 0, extra = {}) => ({ type: 'set_portfolio_theme', toolName: 'set_portfolio_theme',
  toolCallId: `Native_Call_${index}`, theme: 'dark', toolTask: { ...scope, stepIndex: index,
    source: 'native', dispatchStatus: 'accepted' }, ...extra });
const getter = (index = 1) => ({ type: 'report_portfolio_ui_settings', toolName: 'get_portfolio_ui_settings',
  toolCallId: `ui-verify:${index}`, available: false, uiSettings: null,
  toolTask: { ...scope, stepIndex: index, source: 'auxiliary', dispatchStatus: 'reported' } });
const responseTask = (executions, extra = {}) => ({ ...scope, dispatchComplete: true,
  status: executions.some(item => item.toolTask.dispatchStatus === 'accepted') ? 'awaiting_browser'
    : executions.length ? 'completed' : 'not_required', steps: executions.map(stepFromExecution), ...extra });
const response = (executions = [], extra = {}) => ({ mode: 'model', status: 'online', generated: true,
  answer: '요청을 처리합니다.', segments: [], audience: 'default', tone: 'official', pageContext: 'default',
  actions: [], suggestedQuestions: [], toolExecutions: executions, cached: false,
  toolTask: responseTask(executions), ...extra });
const parseExecution = value => parseTaskToolExecution(value, scope, chatParse.parseToolExecution);

test('v1 scope는 대화·턴·작업·세대·스키마를 정확히 비교하며 추적 ID 원문을 보존한다', () => {
  assert.deepEqual(expectedToolTaskScope(request()), scope);
  assert.equal(expectedToolTaskScope({}), undefined);
  for (const field of ['conversationId', 'turnId', 'taskId', 'generation', 'schemaVersion']) {
    const wrong = { ...scope, status: 'running', [field]: field === 'generation' ? 2 : 'wrong' };
    assert.throws(() => assertToolTaskMeta(wrong, scope), ToolTaskProtocolError);
  }
  for (const generation of [0, -1, 1.5, 2_147_483_648, NaN]) {
    assert.throws(() => expectedToolTaskScope(request({ toolTask: { ...request().toolTask, generation } })), ToolTaskProtocolError);
  }
  const native = 'A'.repeat(128);
  assert.equal(parseExecution(execution(0, { toolCallId: native })).toolCallId, native);
  assert.throws(() => parseExecution(execution(0, { toolCallId: `${native}A` })), ToolTaskProtocolError);
  for (const badId of ['native\n', 'native\r', 'native\r\n', 'native\u2028', ' native', 'native ']) {
    assert.throws(() => parseExecution(execution(0, { toolCallId: badId })), ToolTaskProtocolError);
    assert.throws(() => expectedToolTaskScope(request({ conversationId: badId })), ToolTaskProtocolError);
    assert.throws(() => parseToolTaskSteps([{ ...stepFromExecution(execution()), toolCallId: badId }]), ToolTaskProtocolError);
  }
  assert.throws(() => parseTaskToolExecution(execution(), scope, base => ({ ...base, toolCallId: 'rewritten-id' })), ToolTaskProtocolError);
});

test('새 작업은 UUID·세대1, 실행 재시도만 세대 증가하고 확인 요청은 그대로다', () => {
  const task = createChatToolTask(() => 'task-native-uuid');
  assert.deepEqual(task, { schemaVersion: scope.schemaVersion, taskId: 'task-native-uuid', generation: 1 });
  assert.deepEqual(nextChatToolTaskGeneration(task), { ...task, generation: 2 });
  assert.equal(task.generation, 1);
  assert.throws(() => nextChatToolTaskGeneration({ ...task, generation: 2_147_483_647 }));
});

test('task-v1은 16개 전체를 읽으며 17개·중간 invalid·legacy 별칭·unknown 필드를 버리거나 자르지 않는다', () => {
  const sixteen = Array.from({ length: 16 }, (_, index) => execution(index));
  assert.equal(chatParse.parseChatResponse(response(sixteen), request()).toolExecutions.length, 16);
  const seventeen = [...sixteen, execution(16)];
  assert.throws(() => chatParse.parseChatResponse(response(seventeen), request()), ToolTaskProtocolError);
  const broken = structuredClone(sixteen); broken[7].theme = 'invalid';
  assert.throws(() => chatParse.parseChatResponse(response(broken), request()), ToolTaskProtocolError);
  assert.throws(() => parseExecution(execution(0, { toolName: 'set-portfolio-theme' })), ToolTaskProtocolError);
  assert.throws(() => parseExecution(execution(0, { action: 'extra' })), ToolTaskProtocolError);
  assert.throws(() => parseExecution({ ...execution(), toolTask: undefined }), ToolTaskProtocolError);
  assert.throws(() => parseExecution({ ...execution(), type: 'show_portfolio_log_results', toolName: 'search_portfolio_logs' }), ToolTaskProtocolError);
});

test('manifest는 연속 순서·고유 ID·native/aux·accepted/reported와 실행 배열에 1:1 일치한다', () => {
  const executions = [execution(), getter()];
  assert.deepEqual(parseToolTaskSteps(executions.map(stepFromExecution)), executions.map(stepFromExecution));
  for (const change of [steps => { steps[1].stepIndex = 0; }, steps => { steps[1].toolCallId = steps[0].toolCallId; },
    steps => { steps[0].source = 'auxiliary'; }, steps => { steps[1].dispatchStatus = 'accepted'; },
    steps => { steps[1].toolName = 'get_portfolio_view_state'; }]) {
    const steps = executions.map(stepFromExecution); change(steps);
    assert.throws(() => parseToolTaskSteps(steps), ToolTaskProtocolError);
  }
  assert.throws(() => parseExecution({ ...getter(), type: 'report_portfolio_view_state', toolName: 'get_portfolio_view_state',
    viewState: null, uiSettings: undefined }), ToolTaskProtocolError);
  assert.throws(() => chatParse.parseChatResponse(response(executions, {
    toolTask: responseTask(executions, { steps: executions.map(stepFromExecution).reverse() }),
  }), request()), ToolTaskProtocolError);
  assert.throws(() => chatParse.parseChatResponse(response(executions, {
    toolTask: responseTask(executions, { status: 'completed' }),
  }), request()), ToolTaskProtocolError);
});

test('도구 없는 upstream offline fallback만 초기 failed done을 허용하고 변경 발행 실패로 확대하지 않는다', () => {
  const offline = response([], { mode: 'retrieval_fallback', status: 'upstream_offline', generated: false,
    toolTask: responseTask([], { status: 'failed' }) });
  assert.equal(chatParse.parseChatResponse(offline, request()).mode, 'retrieval_fallback');
  assert.throws(() => chatParse.parseChatResponse(response([], { toolTask: offline.toolTask }), request()), ToolTaskProtocolError);
  assert.throws(() => chatParse.parseChatResponse({ ...offline, toolExecutions: [execution()],
    toolTask: responseTask([execution()], { status: 'failed' }) }, request()), ToolTaskProtocolError);
});

test('같은 native ID·step·실행 내용만 중복 무시하며 변조·역순·gap·다른 scope는 거부한다', () => {
  const task = new ToolTaskRuntime(scope, () => true);
  assert.equal(task.accept(execution()), true);
  assert.equal(task.accept({ ...execution(), theme: 'dark' }), false);
  assert.throws(() => task.accept(execution(0, { theme: 'light' })), ToolTaskProtocolError);
  assert.throws(() => task.accept(execution(2)), ToolTaskProtocolError);
  assert.throws(() => task.accept(execution(1, { toolCallId: execution().toolCallId })), ToolTaskProtocolError);
  assert.throws(() => task.accept(execution(1, { toolTask: { ...scope, generation: 2, stepIndex: 1, source: 'native', dispatchStatus: 'accepted' } })), ToolTaskProtocolError);
});

test('accepted는 미실행이며 getter reported를 arrived/applied로 승격하지 않는다', () => {
  const task = new ToolTaskRuntime(scope, () => true);
  task.accept(execution()); task.accept(getter());
  assert.deepEqual(task.snapshot().steps.map(step => step.state), ['accepted', 'reported']);
  assert.equal(task.mutationDispatchCount, 0);
  assert.throws(() => task.start(getter().toolCallId), ToolTaskProtocolError, '앞선 변경의 관측 전에는 다음 단계를 실행하지 않는다');
  task.start(execution().toolCallId);
  assert.equal(task.mutationDispatchCount, 1);
  task.observe({ callId: execution().toolCallId, status: 'applied' });
  task.seal(responseTask([execution(), getter()]));
  task.awaitingVerification();
  task.finish('completed');
  assert.deepEqual(task.snapshot().steps.map(step => step.state), ['applied', 'reported']);
  assert.match(toolTaskStepText(task.snapshot().steps[1]), /브라우저 확인 아님/);
  assert.match(toolTaskSummary(task.snapshot()), /1\/1단계 확인/);
});

test('취소는 관측된 prefix를 유지하고 대기·늦은 단계가 화면에 새 부작용을 내지 못한다', () => {
  let active = true;
  const task = new ToolTaskRuntime(scope, () => active);
  task.accept(execution()); task.accept(execution(1));
  task.start(execution().toolCallId); task.observe({ callId: execution().toolCallId, status: 'applied' });
  active = false; task.terminate('cancelled');
  assert.equal(task.start(execution(1).toolCallId), false);
  assert.equal(task.accept(execution(2)), false);
  assert.deepEqual(task.snapshot().steps.map(step => step.state), ['applied', 'cancelled']);
  assert.equal(task.snapshot().status, 'cancelled');
});

test('done 없는 prefix는 seal·완료가 아니고 대기 중 단계가 남아도 완료로 만들 수 없다', () => {
  const task = new ToolTaskRuntime(scope, () => true);
  task.accept(execution());
  assert.throws(() => task.finish('completed'), ToolTaskProtocolError);
  task.seal(responseTask([execution()]));
  assert.throws(() => task.awaitingVerification(), ToolTaskProtocolError);
});

test('verification은 getter 구멍을 포함한 원 stepIndex와 전체 accepted 관측을 일치시킨다', () => {
  const all = [execution(), getter(), execution(2)];
  const verificationRequest = request({ toolTask: { ...request().toolTask, steps: all.map(stepFromExecution), dispatchComplete: true },
    toolVerification: { results: [0, 2].map(index => ({ toolCallId: `Native_Call_${index}`, toolName: 'set_portfolio_theme', stepIndex: index, status: 'applied', elapsedMs: 600 })) } });
  assert.equal(parseToolTaskResponse(responseTask(all, { status: 'completed' }), verificationRequest, []).status, 'completed');
  const bad = structuredClone(verificationRequest); bad.toolVerification.results[1].stepIndex = 1;
  assert.throws(() => parseToolTaskResponse(responseTask(all, { status: 'completed' }), bad, []), ToolTaskProtocolError);
  bad.toolVerification.results[1].stepIndex = 2; bad.toolVerification.results[1].status = 'failed';
  assert.throws(() => parseToolTaskResponse(responseTask(all, { status: 'completed' }), bad, []), ToolTaskProtocolError);
  assert.throws(() => parseToolTaskResponse(responseTask(all, { status: 'completed', generation: 2 }), verificationRequest, []), ToolTaskProtocolError);
});

function fixtureApi(fetchFixture, env = {}) {
  const require = createRequire(import.meta.url);
  const source = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
  const compiled = require('typescript').transpileModule(source, {
    compilerOptions: { target: require('typescript').ScriptTarget.ES2022, module: require('typescript').ModuleKind.CommonJS },
  }).outputText;
  const api = { exports: {} };
  new Function('require', 'module', 'exports', 'fetch', 'process', compiled)(
    name => name === './parse' ? chatParse : require(name), api, api.exports,
    fetchFixture, { env: { NEXT_PUBLIC_RAG_API_BASE_URL: 'https://fixture.invalid', ...env } });
  return api.exports;
}
const sse = events => new Response(events.map(([kind, data]) => `event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`).join(''),
  { headers: { 'content-type': 'text/event-stream' } });

test('실제 JSON/SSE 오류는 HTTP상태·용량코드·서버 재시도 소진 boolean을 같은 계약으로 보존한다', async () => {
  for (const streaming of [false, true]) {
    for (const [status, code, expected] of [[400, 'context_length_exceeded', 'capacity'],
      [413, 'payload_too_large', 'capacity'], [502, 'request_too_large', 'capacity'],
      [503, 'upstream_unavailable', 'transient'], [409, 'context_length_exceeded', undefined],
      [401, 'upstream_unavailable', undefined]]) {
      const api = fixtureApi(async () => Response.json({ error: code, message: 'private', retryExhausted: true }, { status }));
      await assert.rejects(streaming ? api.requestChatStream(request(), new AbortController().signal, { onDelta() {} })
        : api.requestChat(request(), new AbortController().signal), error => {
        assert.equal(error.httpStatus, status);
        assert.equal(error.retryExhausted, true);
        assert.equal(chatRetryFailureKind(error), expected);
        return true;
      });
    }
    for (const [payload, expected] of [
      [{ code: 'context_length_exceeded' }, 'capacity'],
      [{ code: 'context_length_exceeded', error: 'context_length_exceeded' }, 'capacity'],
      [{ code: 'context_length_exceeded', error: 'upstream_busy' }, undefined],
      [{ code: 'context_length_exceeded', error: { hidden: 'private' } }, undefined],
    ]) {
      const api = fixtureApi(async () => Response.json(payload, { status: 502 }));
      await assert.rejects(streaming ? api.requestChatStream(request(), new AbortController().signal, { onDelta() {} })
        : api.requestChat(request(), new AbortController().signal), error => {
        assert.equal(chatRetryFailureKind(error), expected);
        return true;
      });
    }
    const htmlAuth = fixtureApi(async () => new Response('<html>private</html>', { status: 403 }));
    await assert.rejects(streaming ? htmlAuth.requestChatStream(request(), new AbortController().signal, { onDelta() {} })
      : htmlAuth.requestChat(request(), new AbortController().signal), error =>
      error.code === 'authentication_error' && error.httpStatus === 403 && chatRetryFailureKind(error) === undefined);
    const limited = fixtureApi(async () => new Response('limited', { status: 429, headers: { 'retry-after': '2' } }));
    await assert.rejects(streaming ? limited.requestChatStream(request(), new AbortController().signal, { onDelta() {} })
      : limited.requestChat(request(), new AbortController().signal), error =>
      error.code === 'rate_limited' && error.httpStatus === 429 && error.retryAfterMs === 2_000);
  }
  for (const retryExhausted of [true, false, 'true', 1, undefined]) {
    const api = fixtureApi(async () => sse([['error', { code: 'context_length_exceeded', retryExhausted }]]));
    await assert.rejects(api.requestChatStream(request(), new AbortController().signal, { onDelta() {} }), error => {
      assert.equal(error.code, 'context_length_exceeded');
      assert.equal(error.retryExhausted, retryExhausted === true);
      assert.equal(error.httpStatus, undefined);
      return true;
    });
  }
  const brokenStream = fixtureApi(async () => new Response(new ReadableStream({
    start(controller) { controller.error(new TypeError('private network failure')); },
  }), { headers: { 'content-type': 'text/event-stream' } }));
  await assert.rejects(brokenStream.requestChatStream(request(), new AbortController().signal, { onDelta() {} }),
    error => error.code === 'network' && chatRetryFailureKind(error) === 'transient');
});

test('실제 JSON/SSE API는 같은 scope·원 native ID와 ordered manifest를 보존하고 중복 SSE를 실행하지 않는다', async () => {
  const write = execution(); const read = getter(); const done = response([write, read]);
  const meta = ['meta', { toolTask: { ...scope, status: 'running' } }];
  for (const streaming of [false, true]) {
    const api = fixtureApi(async () => streaming
      ? sse([meta, ['tool', write], ['tool', write], ['tool', read], ['done', done]]) : Response.json(done));
    const seen = [];
    const result = streaming
      ? await api.requestChatStream(request(), new AbortController().signal, { onDelta() {}, onTool: item => seen.push(item) })
      : await api.requestChat(request(), new AbortController().signal);
    assert.deepEqual(result.toolTask, done.toolTask);
    assert.equal(result.toolExecutions[0].toolCallId, write.toolCallId);
    if (streaming) assert.deepEqual(seen.map(item => item.toolCallId), [write.toolCallId, read.toolCallId]);
  }
});

test('실제 SSE API는 누락 meta·scope 혼선·역순·같은 ID 변조·done 변조를 거부한다', async () => {
  const write = execution(); const meta = ['meta', { toolTask: { ...scope, status: 'running' } }];
  const cases = [
    [['tool', write], ['done', response([write])]],
    [meta, ['tool', { ...write, toolTask: { ...write.toolTask, turnId: 'old-turn' } }]],
    [meta, ['tool', execution(1)]],
    [meta, ['tool', write], ['tool', { ...write, theme: 'light' }]],
    [meta, ['tool', write], ['done', response([{ ...write, theme: 'light' }])]],
    [meta, ['tool', write], ['done', response([])]],
  ];
  for (const events of cases) {
    const api = fixtureApi(async () => sse(events));
    await assert.rejects(api.requestChatStream(request(), new AbortController().signal, { onDelta() {}, onTool() {} }), ToolTaskProtocolError);
  }
});

test('실제 SSE verification 응답은 새로운 tool 이벤트를 callback 전에 차단한다', async () => {
  const api = fixtureApi(async () => sse([['meta', { toolTask: { ...scope, status: 'running' } }], ['tool', execution()]]));
  let calls = 0;
  await assert.rejects(api.requestChatStream(request({ toolVerification: { results: [] } }), new AbortController().signal,
    { onDelta() {}, onTool() { calls++; } }), ToolTaskProtocolError);
  assert.equal(calls, 0);
});

test('최종 확인 SSE의 잘못된 done scope는 이미 받은 delta를 버리되 실제 도구 완료는 보존한다', async () => {
  const write = execution(); const manifest = responseTask([write]);
  const verifiedRequest = request({ toolTask: { ...request().toolTask, steps: manifest.steps, dispatchComplete: true },
    toolVerification: { results: [{ toolCallId: write.toolCallId, toolName: write.toolName,
      stepIndex: 0, status: 'applied', elapsedMs: 600 }] } });
  const api = fixtureApi(async () => sse([
    ['meta', { toolTask: { ...scope, status: 'running' } }],
    ['delta', { text: 'WRONG_TURN_TEXT' }],
    ['done', response([], { toolTask: { ...manifest, turnId: 'old-turn', status: 'completed' } })],
  ]));
  const chips = [{ callId: write.toolCallId, tool: write.toolName, status: 'applied', label: '다크 모드' }];
  const progress = { scope, status: 'completed', dispatchComplete: true,
    steps: [{ ...stepFromExecution(write), state: 'applied' }] };
  let message = { id: 'current-answer', role: 'assistant', kind: 'message', content: '', toolResults: chips, toolTaskProgress: progress };
  await assert.rejects(api.requestChatStream(verifiedRequest, new AbortController().signal, {
    onDelta(text) { message = { ...message, content: message.content + text }; },
  }), error => {
    assert.ok(error instanceof ToolTaskProtocolError);
    assert.equal(message.content, 'WRONG_TURN_TEXT');
    message = failedChatMessage(message, error instanceof ToolTaskProtocolError);
    return true;
  });
  assert.equal(message.content, '');
  assert.equal(message.generationState, 'failed');
  assert.deepEqual(message.toolResults, chips);
  assert.equal(message.toolTaskProgress.status, 'completed');
  const provider = readFileSync(new URL('./ChatProvider.tsx', import.meta.url), 'utf8');
  assert.match(provider, /const discardUnverifiedContent = deferStreamDeltas \|\| protocolFailure \|\| toolReportFailure === "response_contract"/u);
  assert.match(provider, /toolTaskProgress: taskSnapshot\(\), \.\.\.reportSnapshot\(\) \}, discardUnverifiedContent\)/u);
});

test('확인 후속은 원 native 이력이 없으면 보내지 않고 요청 취소 뒤 돌아온 응답도 반영하지 않는다', async () => {
  const write = execution();
  const initial = request({ toolTask: { ...request().toolTask, steps: [stepFromExecution(write)], dispatchComplete: true } });
  const observations = [{ toolCallId: write.toolCallId, toolName: write.toolName, stepIndex: 0, status: 'applied', elapsedMs: 600 }];
  let sends = 0;
  await assert.rejects(requestVerifiedToolResponse(Promise.resolve(), initial, observations, () => ({}),
    async () => { sends++; return response([]); }, new AbortController().signal), ToolTaskProtocolError);
  assert.equal(sends, 0);
  const controller = new AbortController();
  await assert.rejects(requestVerifiedToolResponse(Promise.resolve(), { message: 'test', history: [] }, [], () => ({}),
    async () => { controller.abort(); return { toolExecutions: [] }; }, controller.signal), { name: 'AbortError' });
});

test('Provider는 stop/partial prefix의 실행 retry를 없애고 정상 verification retry만 같은 세대를 쓴다', () => {
  const provider = readFileSync(new URL('./ChatProvider.tsx', import.meta.url), 'utf8');
  const caught = provider.slice(provider.indexOf('} catch (requestError)'), provider.indexOf('\n      } finally', provider.indexOf('} catch (requestError)')));
  assert.match(caught, /if \(protocolFailure \|\| \(!pending\.toolVerification && !taskRuntime\?\.dispatchComplete\)\) controller\.abort\(\)/u);
  assert.match(caught, /retryRef\.current = null/u);
  assert.match(caught, /Boolean\(pending\.toolReportRequest && pending\.toolVerification && pending\.toolTask\.dispatchComplete\)/u);
  assert.doesNotMatch(caught, /pending\.toolVerification =/u, 'done 없는 prefix를 임의 확인 요청으로 바꾸지 않는다');
  const retry = provider.slice(provider.indexOf('const prepareRetry ='), provider.indexOf('const stopGenerating ='));
  assert.match(retry, /if \(!pending\.toolVerification\) \{\s*pending\.retryNotice[^;]+;\s*pending\.toolTask = nextChatToolTaskGeneration/u);
  const widget = readFileSync(new URL('./ChatWidget.tsx', import.meta.url), 'utf8');
  assert.match(widget, /latestMessage\.retryAllowed !== false/u);
});

test('브라우저 관측은 허용 metadata만 투영하고 getter를 성공으로 만들지 않으며 task 취소에 도구 필드를 붙이지 않는다', async () => {
  let eventCounter = 0; const sent = [];
  const telemetry = new BrowserToolTaskTelemetry({ ...scope, hiddenQuestion: 'private' }, async body => { sent.push(body); }, () => `event-${++eventCounter}`);
  telemetry.tool({ ...stepFromExecution(execution()), arguments: 'private', result: 'private', url: 'private' }, 'started');
  telemetry.tool(stepFromExecution(execution()), 'applied');
  telemetry.tool(stepFromExecution(getter()), 'applied');
  telemetry.task('cancelled');
  await telemetry.flush();
  assert.equal(sent.length, 1);
  assert.equal(isSafeBrowserToolTaskEvents(sent[0]), true);
  assert.deepEqual(sent[0].events.map(event => event.status), ['started', 'applied', 'cancelled']);
  assert.deepEqual(sent[0].events.map(event => event.sequence), [0, 1, 2]);
  assert.deepEqual(Object.keys(sent[0]).sort(), ['conversationId', 'events', 'generation', 'taskId', 'turnId', 'version']);
  assert.doesNotMatch(JSON.stringify(sent), /private|arguments|result|url|schemaVersion/u);
  assert.equal(Object.hasOwn(sent[0].events[2], 'toolCallId'), false);
});

test('브라우저 관측은 32개 단위로 나누고 전송 대기 중 다음 배치도 순서대로만 보낸다', async () => {
  let eventCounter = 0; let releaseFirst; const sent = [];
  const first = new Promise(resolve => { releaseFirst = resolve; });
  const telemetry = new BrowserToolTaskTelemetry(scope, async body => {
    sent.push(body); if (sent.length === 1) await first;
  }, () => `event-${++eventCounter}`);
  for (let index = 0; index < 16; index++) {
    telemetry.tool(stepFromExecution(execution(index)), 'started');
    telemetry.tool(stepFromExecution(execution(index)), 'applied');
  }
  telemetry.task('completed');
  const completion = telemetry.flush();
  await Promise.resolve();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].events.length, 32);
  releaseFirst(); await completion;
  assert.equal(sent.length, 2);
  assert.equal(sent[1].events[0].sequence, 32);
  assert.equal(new Set(sent.flatMap(body => body.events.map(event => event.eventId))).size, 33);
  assert.ok(sent.every(body => new TextEncoder().encode(JSON.stringify(body)).byteLength <= 16 * 1024));
});

test('브라우저 task terminal은 최종 답변 실패·취소·검증 재시도로 바뀌거나 중복되지 않는다', async () => {
  let counter = 0; const sent = [];
  const telemetry = new BrowserToolTaskTelemetry(scope, async body => { sent.push(body); }, () => `event-${++counter}`);
  telemetry.tool(stepFromExecution(execution()), 'started');
  telemetry.tool(stepFromExecution(execution()), 'applied');
  telemetry.task('completed');
  telemetry.task('failed'); telemetry.task('cancelled'); telemetry.task('completed');
  telemetry.tool(stepFromExecution(execution()), 'failed');
  await telemetry.flush();
  assert.deepEqual(sent.flatMap(body => body.events.map(event => event.status)), ['started', 'applied', 'completed']);
  const task = new ToolTaskRuntime(scope, () => true);
  task.accept(execution()); task.start(execution().toolCallId);
  task.observe({ callId: execution().toolCallId, status: 'applied' });
  task.seal(responseTask([execution()])); task.finish('completed');
  task.terminate('failed'); task.terminate('cancelled');
  assert.equal(task.snapshot().status, 'completed');
  const provider = readFileSync(new URL('./ChatProvider.tsx', import.meta.url), 'utf8');
  const browserFinish = provider.indexOf('taskTelemetry.task(browserStatus)');
  const finalRequest = provider.indexOf('response = await requestVerifiedToolResponse(');
  assert.ok(browserFinish > 0 && browserFinish < finalRequest);
  assert.match(provider, /if \(verificationToolCallIds\.size > 0\) taskTelemetry\.task\("cancelled"\)/u);
  assert.match(provider, /if \(verificationToolCallIds\.size > 0\) taskTelemetry\.task\("failed"\)/u);
  assert.doesNotMatch(provider, /taskTelemetry\.task\(resultStatus\)/u, '일반 답변에 완료 telemetry를 만들지 않는다');
});

test('브라우저 관측 ID는 끝 개행도 거절하고 128자 원문을 수정하지 않는다', async () => {
  const base = { version: 1, conversationId: scope.conversationId, turnId: scope.turnId,
    taskId: scope.taskId, generation: 1, events: [{ eventId: 'e'.repeat(128), sequence: 0,
      source: 'browser', agentRole: 'verifier', kind: 'task', status: 'cancelled' }] };
  assert.equal(isSafeBrowserToolTaskEvents(base), true);
  for (const suffix of ['\n', '\r', '\r\n', '\u2028', ' ']) {
    assert.equal(isSafeBrowserToolTaskEvents({ ...base, conversationId: `conversation${suffix}` }), false);
    assert.equal(isSafeBrowserToolTaskEvents({ ...base, events: [{ ...base.events[0], eventId: `event${suffix}` }] }), false);
    let sends = 0;
    const telemetry = new BrowserToolTaskTelemetry(scope, async () => { sends++; }, () => `event${suffix}`);
    telemetry.tool(stepFromExecution(execution()), 'started'); await telemetry.flush();
    assert.equal(sends, 0);
    const badCall = new BrowserToolTaskTelemetry(scope, async () => { sends++; }, () => 'valid-event');
    badCall.tool({ ...stepFromExecution(execution()), toolCallId: `call${suffix}` }, 'started'); await badCall.flush();
    assert.equal(sends, 0);
  }
});

test('관측 API는 기본 off이며 명시적 on일 때만 같은 API 경로·별도 timeout·keepalive를 쓴다', async () => {
  const body = { version: 1, conversationId: scope.conversationId, turnId: scope.turnId,
    taskId: scope.taskId, generation: 1, events: [{ eventId: 'event-1', sequence: 0, source: 'browser',
      agentRole: 'verifier', kind: 'task', status: 'cancelled' }] };
  let sends = 0;
  const fetchFixture = async (url, options) => {
    sends++;
    assert.equal(url, 'https://fixture.invalid/api/chat/tool-events');
    assert.equal(options.keepalive, true); assert.equal(options.signal.aborted, false);
    assert.deepEqual(JSON.parse(options.body), body);
    assert.deepEqual(options.headers, { 'content-type': 'application/json' });
    throw new Error('fixture network failure');
  };
  await fixtureApi(fetchFixture).requestToolTaskEvents(body);
  assert.equal(sends, 0);
  await fixtureApi(fetchFixture, { NEXT_PUBLIC_TOOL_TASK_TELEMETRY_ENABLED: 'false' }).requestToolTaskEvents(body);
  assert.equal(sends, 0);
  const enabled = fixtureApi(fetchFixture, { NEXT_PUBLIC_TOOL_TASK_TELEMETRY_ENABLED: 'true' });
  await assert.doesNotReject(enabled.requestToolTaskEvents(body));
  assert.equal(sends, 1, '네트워크 실패가 실행/채팅 오류로 전파되지 않는다');
  for (const bad of [
    { ...body, message: 'private' },
    { ...body, events: [{ ...body.events[0], arguments: 'private' }] },
    { ...body, events: [{ ...body.events[0], toolCallId: 'fake' }] },
    { ...body, events: [{ ...body.events[0], status: 'arrived' }] },
    { ...body, events: Array(33).fill(body.events[0]) },
  ]) {
    assert.equal(isSafeBrowserToolTaskEvents(bad), false);
    await enabled.requestToolTaskEvents(bad);
  }
  assert.equal(sends, 1, 'unknown/private/oversize 필드는 API 직전에도 차단한다');
});

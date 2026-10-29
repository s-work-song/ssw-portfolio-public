import assert from 'node:assert/strict';
import test from 'node:test';
import {
  runBrowserToolCall,
  runBrowserToolCalls,
  TOOL_OBSERVATION_MIN_DELAY_MS,
} from '../../../../src/features/chat/workflow/browserToolRunner.ts';

const flush = () => new Promise(resolve => setImmediate(resolve));
const theme = (value = 'dark', callId = 'theme-1') => ({ callId, name: 'set_portfolio_theme', arguments: { theme: value } });
const nav = (action = 'research-2025', callId = 'nav-1') => ({ callId, name: 'control_portfolio_view', arguments: { action } });
const SETTING_KEYS = { set_portfolio_theme: ['theme', 'theme'], set_portfolio_chat_font_size: ['size', 'chatFontSize'],
  set_portfolio_chat_layout: ['layout', 'chatLayout'] };
const dock = (callId = 'layout-1') => ({ callId, name: 'set_portfolio_chat_layout', arguments: { layout: 'dock' } });
const mockedTests = new WeakSet();

/**
 * 실행기·관측 함수를 주입한 runner fixture다. setTimeout과 now()를 같은 가짜 시계로 움직여
 * 최소 관측 500ms·설정 반영 대기를 실제로 기다리지 않고 검증한다.
 */
function fixture(t, options = {}) {
  if (!mockedTests.has(t)) {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    mockedTests.add(t);
  }
  let clock = 0;
  const state = {
    settings: { theme: 'light', accent: 'royalblue', chatLayout: 'floating', chatFont: 'pretendard',
      chatFontSize: 'medium', streamAnimation: 'none' },
    view: { page: 'overview', anchor: null, researchTab: null, researchYear: null, researchDetails: null },
    executed: [], reports: [], observed: [], beforeNavigate: 0,
  };
  const deps = {
    async execute(command) {
      state.executed.push([command.name, structuredClone(command.input), command.signal]);
      if (options.execute) return options.execute(command, state);
      const setting = SETTING_KEYS[command.name];
      if (setting && options.applySettings !== false) {
        state.settings = { ...state.settings, [setting[1]]: command.input[setting[0]] };
      }
      if (command.name === 'control_portfolio_view') {
        return { ok: true, route: '/about-me/research#research-year-2025', label: '연구 여정 2025년' };
      }
      return { ok: true };
    },
    readSettings: () => state.settings,
    readViewState: () => state.view,
    async observeNavigation(route, startedAt, signal) {
      state.observed.push({ route, startedAt, signal });
      return options.observeNavigation ? options.observeNavigation(route, startedAt, signal) : 'arrived';
    },
    beforeNavigate: () => { state.beforeNavigate += 1; },
    report: result => state.reports.push(structuredClone(result)),
    ...(options.chatDockFits ? { chatDockFits: options.chatDockFits } : {}),
    now: () => clock,
  };
  return {
    state, deps,
    get clock() { return clock; },
    /** promise가 끝날 때까지 50ms씩 시계를 움직이고, 끝난 시각을 돌려준다. */
    async drive(promise, limit = 10_000) {
      let doneAt = null;
      promise.then(() => { doneAt = clock; }, () => { doneAt = clock; });
      await flush();
      while (doneAt === null && clock < limit) {
        clock += 50;
        t.mock.timers.tick(50);
        await flush();
      }
      assert.notEqual(doneAt, null, '도구 실행이 시간 상한 안에 끝나야 한다');
      return doneAt;
    },
  };
}

test('설정 도구는 실제 반영을 확인하고 최소 관측 시간 뒤 값과 바꾸기 전 값(previous)을 돌려준다', async t => {
  const f = fixture(t);
  const signal = new AbortController().signal;
  const running = runBrowserToolCall(theme('dark'), f.deps, signal);
  const doneAt = await f.drive(running);
  assert.equal(doneAt, TOOL_OBSERVATION_MIN_DELAY_MS, '반영이 빨라도 최소 관측 시간까지 기다린다');
  assert.deepEqual(await running, { callId: 'theme-1', ok: true, output: { theme: 'dark', previous: 'light' } });
  assert.equal(f.state.executed.length, 1);
  assert.equal(f.state.executed[0][2], signal, '실행기에 같은 중단 신호를 넘긴다');
  assert.deepEqual(f.state.reports, [
    { callId: 'theme-1', tool: 'set_portfolio_theme', label: '화면 모드 · 다크', status: 'started' },
    { callId: 'theme-1', tool: 'set_portfolio_theme', label: '화면 모드 · 다크', status: 'applied' },
  ]);
});

test('설정이 화면에 반영되지 않으면 상한까지 확인한 뒤 not_applied 실패로 돌려준다', async t => {
  const f = fixture(t, { applySettings: false });
  const running = runBrowserToolCall({ callId: 'size-1', name: 'set_portfolio_chat_font_size',
    arguments: { size: 'xlarge' } }, f.deps, new AbortController().signal);
  const doneAt = await f.drive(running);
  assert.ok(doneAt >= 1_200 && doneAt < 1_300, `반영 확인 상한(1.2초) 근처에서 끝난다: ${doneAt}`);
  assert.deepEqual(await running, { callId: 'size-1', ok: false,
    output: { size: 'xlarge', previous: 'medium', error: 'not_applied' } });
  assert.deepEqual(f.state.reports.map(item => [item.status, item.detail]),
    [['started', undefined], ['failed', '설정이 화면에 반영되지 않았어요']]);
  assert.equal(f.state.reports[0].label, '채팅 글자 크기 · 매우 크게');
});

test('좁은 화면에서 고정 패널로 바꾸면 저장은 하되 지금은 플로팅 창으로 보인다는 사실을 결과에 담는다', async t => {
  const f = fixture(t, { chatDockFits: () => false });
  const running = runBrowserToolCall(dock(), f.deps, new AbortController().signal);
  await f.drive(running);
  const result = await running;
  assert.equal(result.ok, true);
  assert.equal(f.state.settings.chatLayout, 'dock', '설정 값은 dock으로 저장한다');
  assert.equal(result.output.layout, 'dock');
  assert.equal(result.output.previous, 'floating');
  assert.equal(result.output.displayed, 'floating');
  assert.match(result.output.notice, /1100px보다 좁아 지금은 플로팅 창으로 보입니다/u);
});

test('넓은 화면이거나 화면 판단 함수가 없으면 고정 패널 변경 결과에 너비 안내를 붙이지 않는다', async t => {
  for (const options of [{ chatDockFits: () => true }, {}]) {
    const f = fixture(t, options);
    const running = runBrowserToolCall(dock(), f.deps, new AbortController().signal);
    await f.drive(running);
    assert.deepEqual(await running, { callId: 'layout-1', ok: true, output: { layout: 'dock', previous: 'floating' } });
  }
});

test('이동 도구는 목적지 도착을 관측해 경로·이전 위치와 함께 arrived를 돌려준다', async t => {
  const f = fixture(t);
  f.state.view = { ...f.state.view, page: 'resume', anchor: 'resume-career' };
  const signal = new AbortController().signal;
  const result = await runBrowserToolCall(nav(), f.deps, signal);
  assert.deepEqual(result, { callId: 'nav-1', ok: true, output: {
    action: 'research-2025', route: '/about-me/research#research-year-2025', label: '연구 여정 2025년',
    arrived: true, previous: { page: 'resume', anchor: 'resume-career' },
  } });
  assert.equal(f.state.beforeNavigate, 1);
  assert.deepEqual(f.state.observed, [{ route: '/about-me/research#research-year-2025', startedAt: 0, signal }]);
  assert.deepEqual(f.state.reports.map(item => [item.action, item.label, item.status]), [
    ['research-2025', '연구 여정 2025년', 'started'], ['research-2025', '연구 여정 2025년', 'arrived'],
  ]);

  const settings = await runBrowserToolCall({ callId: 'settings-1', name: 'open_portfolio_settings', arguments: {} },
    { ...f.deps, execute: async () => ({ ok: true, route: '/about-me/settings', label: '포트폴리오 설정' }) }, signal);
  assert.equal(settings.ok, true);
  assert.equal(settings.output.action, undefined);
  assert.equal(f.state.beforeNavigate, 1, '설정 페이지 열기는 입력창 포커스 복원을 예약하지 않는다');
});

test('도착하지 못한 이동과 목적지를 모르는 이동은 not_arrived 실패로 돌려준다', async t => {
  const failed = fixture(t, { observeNavigation: () => 'failed' });
  const result = await runBrowserToolCall(nav(), failed.deps, new AbortController().signal);
  assert.equal(result.ok, false);
  assert.equal(result.output.arrived, false);
  assert.equal(result.output.error, 'not_arrived');
  assert.equal(failed.state.reports.at(-1).detail, '목적지에 도착하지 못했어요');

  const unknown = fixture(t, { execute: async () => ({ ok: false }) });
  const running = runBrowserToolCall(nav(), unknown.deps, new AbortController().signal);
  const doneAt = await unknown.drive(running);
  assert.equal(doneAt, TOOL_OBSERVATION_MIN_DELAY_MS, '관측할 경로가 없어도 최소 관측 시간은 지킨다');
  const output = (await running).output;
  assert.deepEqual(output, { action: 'research-2025', route: null, label: '화면 이동', arrived: false,
    previous: { page: 'overview', anchor: null }, error: 'not_arrived' });
  assert.deepEqual(unknown.state.observed, [], '경로가 없으면 도착 관측을 시작하지 않는다');
  assert.equal(unknown.state.reports.at(-1).detail, '이동 목적지를 확인하지 못했어요');
});

test('조회 도구는 실행기 출력을 그대로 돌려주고 연구 상세 제어는 실제 반영만 성공으로 본다', async t => {
  const f = fixture(t, { execute: async command => command.name === 'get_portfolio_ui_settings'
    ? { ok: true, uiSettings: { theme: 'light' } }
    : command.name === 'get_portfolio_view_state' ? { ok: false, error: 'unavailable' }
      : { ok: true, status: command.input.action === 'expand' ? 'applied' : 'unchanged', label: '2025 상세' } });
  const signal = new AbortController().signal;
  assert.deepEqual(await runBrowserToolCall({ callId: 'get-1', name: 'get_portfolio_ui_settings', arguments: {} }, f.deps, signal),
    { callId: 'get-1', ok: true, output: { ok: true, uiSettings: { theme: 'light' } } });
  assert.deepEqual(await runBrowserToolCall({ callId: 'get-2', name: 'get_portfolio_view_state', arguments: {} }, f.deps, signal),
    { callId: 'get-2', ok: false, output: { ok: false, error: 'unavailable' } });
  assert.deepEqual(f.state.reports, [], '조회 도구는 화면 칩을 만들지 않는다');

  const expand = runBrowserToolCall({ callId: 'detail-1', name: 'control_portfolio_research_details',
    arguments: { action: 'expand', target: '2025' } }, f.deps, signal);
  await f.drive(expand);
  assert.deepEqual(await expand, { callId: 'detail-1', ok: true,
    output: { ok: true, status: 'applied', label: '2025 상세' } });
  assert.equal(f.state.beforeNavigate, 1, '상세 제어도 연도 앵커로 이동하므로 입력창 포커스 복원을 예약한다');
  const unchanged = runBrowserToolCall({ callId: 'detail-2', name: 'control_portfolio_research_details',
    arguments: { action: 'collapse', target: '2025' } }, f.deps, signal);
  await f.drive(unchanged);
  assert.deepEqual((await unchanged).output, { ok: true, status: 'unchanged', label: '2025 상세', error: 'not_applied' });
  assert.deepEqual(f.state.reports.filter(item => item.callId === 'detail-2').map(item => [item.status, item.target]),
    [['started', '2025'], ['failed', '2025']]);
});

test('실행기 예외는 execution_failed 결과로 바꾸고 원문 오류를 결과에 싣지 않는다', async t => {
  const f = fixture(t, { execute: async () => { throw new TypeError('secret executor stack'); } });
  const signal = new AbortController().signal;
  const result = await runBrowserToolCall(theme(), f.deps, signal);
  assert.deepEqual(result, { callId: 'theme-1', ok: false, output: { error: 'execution_failed' } });
  assert.deepEqual(f.state.reports.map(item => [item.status, item.detail]),
    [['started', undefined], ['failed', '도구를 실행하지 못했어요']]);
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.deepEqual((await runBrowserToolCall(nav(), f.deps, signal)).output, { error: 'execution_failed' });
});

test('사용자 중단은 실패 결과로 바꾸지 않고 AbortError를 다시 던진다', async t => {
  const f = fixture(t, { applySettings: false });
  const controller = new AbortController();
  const running = runBrowserToolCall(theme(), f.deps, controller.signal);
  running.catch(() => undefined);
  await flush();
  t.mock.timers.tick(50);
  await flush();
  controller.abort();
  await assert.rejects(running, { name: 'AbortError' });
  assert.equal(f.state.reports.some(item => item.status === 'failed'), false);

  const aborting = new AbortController();
  const g = fixture(t, { execute: async () => { aborting.abort(); throw new Error('aborted executor'); } });
  await assert.rejects(runBrowserToolCall(theme(), g.deps, aborting.signal), { message: 'aborted executor' },
    '중단 뒤의 실행기 오류도 결과로 숨기지 않는다');
});

test('여러 호출은 앞 도구의 관측이 끝난 뒤 순서대로 실행하고 중단 뒤 남은 도구는 실행하지 않는다', async t => {
  let arrive;
  const f = fixture(t, { observeNavigation: () => new Promise(resolve => { arrive = resolve; }) });
  const signal = new AbortController().signal;
  const running = runBrowserToolCalls([nav(), theme('dark', 'theme-2')], f.deps, signal);
  await flush();
  assert.deepEqual(f.state.executed.map(([name]) => name), ['control_portfolio_view'],
    '이동 도착을 확인하기 전에는 다음 도구를 실행하지 않는다');
  arrive('arrived');
  await f.drive(running);
  const results = await running;
  assert.deepEqual(results.map(item => [item.callId, item.ok]), [['nav-1', true], ['theme-2', true]]);
  assert.deepEqual(f.state.executed.map(([name]) => name), ['control_portfolio_view', 'set_portfolio_theme']);

  const controller = new AbortController();
  const g = fixture(t, { observeNavigation: () => { controller.abort(); return 'arrived'; } });
  await assert.rejects(runBrowserToolCalls([nav(), theme()], g.deps, controller.signal), { name: 'AbortError' });
  assert.deepEqual(g.state.executed.map(([name]) => name), ['control_portfolio_view']);

  const aborted = new AbortController();
  aborted.abort();
  const h = fixture(t);
  await assert.rejects(runBrowserToolCalls([theme()], h.deps, aborted.signal), { name: 'AbortError' });
  assert.deepEqual(h.state.executed, []);
  assert.deepEqual(await runBrowserToolCalls([], h.deps, new AbortController().signal), []);
});

const pick = (setting = 'theme', callId = 'pick-1') => ({ callId, name: 'choose_portfolio_setting', arguments: { setting } });

test('선택지 도구는 말풍선에 선택지를 띄우고 띄울 때의 값과 함께 바로 끝난다', async t => {
  const f = fixture(t);
  const shown = [];
  f.deps.showChoice = request => shown.push(request);
  assert.deepEqual(await runBrowserToolCall(pick('accent'), f.deps, new AbortController().signal),
    { callId: 'pick-1', ok: true, output: { setting: 'accent', shown: true, current: 'royalblue' } });
  assert.deepEqual(shown, [{ callId: 'pick-1', setting: 'accent', current: 'royalblue' }]);
  assert.deepEqual(f.state.executed, [], '선택지를 띄우는 것만으로 설정을 바꾸지 않는다');
  assert.deepEqual(f.state.reports, []);
});

test('선택지를 띄울 수 없는 실행기나 잘못된 setting은 화면을 바꾸지 않고 실패로 돌려준다', async t => {
  const f = fixture(t);
  assert.deepEqual(await runBrowserToolCall(pick(), f.deps, new AbortController().signal),
    { callId: 'pick-1', ok: false, output: { setting: 'theme', error: 'unsupported_tool' } });
  f.deps.showChoice = () => assert.fail('잘못된 setting으로 선택지를 띄우지 않는다');
  assert.deepEqual(await runBrowserToolCall(pick('motion'), f.deps, new AbortController().signal),
    { callId: 'pick-1', ok: false, output: { error: 'execution_failed' } });
  assert.deepEqual(f.state.executed, []);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ACCENTS, CHAT_FONT_SIZES, PORTFOLIO_UI_TOOL_NAMES, PORTFOLIO_UI_TOOLS } from '../portfolio-tools/schema.ts';
import { executePortfolioUiTool } from '../portfolio-tools/portfolioUiToolExecutor.ts';
import { ChatApiError, parseChatResponse } from './parse.ts';
import { stepFromExecution, ToolTaskProtocolError } from './toolTaskRuntime.ts';
import { fourToolReportCase, providerReportFixture } from './toolReportFixtures.mjs';

const accentEntries = ACCENTS.map(accent => ['set_portfolio_accent', { accent }]);
const sizeEntries = CHAT_FONT_SIZES.map(size => ['set_portfolio_chat_font_size', { size }]);

function sequenceCase(entries) {
  const base = fourToolReportCase();
  const calls = entries.map(([name, input], index) => ({ id: `setting_sequence_${index}`, type: 'function',
    function: { name, arguments: ` ${JSON.stringify(input)}\n` } }));
  const executions = calls.flatMap((call, index) => [
    { type: call.function.name, toolName: call.function.name, toolCallId: call.id, ...entries[index][1],
      toolTask: { ...base.scope, stepIndex: index * 2, source: 'native', dispatchStatus: 'accepted' } },
    { type: 'report_portfolio_ui_settings', toolName: 'get_portfolio_ui_settings', toolCallId: `ui-verify:${index}`,
      available: false, uiSettings: null,
      toolTask: { ...base.scope, stepIndex: index * 2 + 1, source: 'auxiliary', dispatchStatus: 'reported' } },
  ]);
  const steps = executions.map(stepFromExecution);
  const native = [{ role: 'assistant', content: null, tool_calls: calls },
    ...calls.map(call => ({ role: 'tool', tool_call_id: call.id, content: '{"accepted":true}' }))];
  const results = calls.map((call, index) => ({ toolCallId: call.id, toolName: call.function.name,
    stepIndex: index * 2, status: 'applied', elapsedMs: 500 }));
  const request = { ...base.request, message: '지원하는 설정값을 요청한 순서대로 하나씩 보여 줘.',
    toolTask: { ...base.request.toolTask, steps } };
  return { ...base, calls, executions, steps, native, results, request };
}

function actualSettingsExecutor(afterApply) {
  return (command, state) => {
    const set = key => value => {
      state.uiSettings[key] = value;
      afterApply?.(command, state);
    };
    return executePortfolioUiTool(command, {
      getSettings: () => state.uiSettings,
      setMode: set('theme'), setAccent: set('accent'), setChatLayout: set('chatLayout'),
      setChatFont: set('chatFont'), setChatFontSize: set('chatFontSize'), setStreamAnimation: set('streamAnimation'),
      navigateRoute: () => assert.fail('설정 setter 순회는 이동하지 않는다'),
    });
  };
}

test('설정 순회는 정본 6색·4크기 setter만 사용하며 폐기한 전용 도구는 실행할 수 없다', () => {
  assert.deepEqual(ACCENTS, ['blue', 'indigo', 'emerald', 'amber', 'rose', 'violet']);
  assert.deepEqual(CHAT_FONT_SIZES, ['small', 'medium', 'large', 'xlarge']);
  assert.equal(PORTFOLIO_UI_TOOL_NAMES.length, 11);
  assert.equal(Object.hasOwn(PORTFOLIO_UI_TOOLS, 'cycle_portfolio_accent'), false);
  for (const name of ['cycle_portfolio_accent', 'cycle-portfolio-accent']) {
    assert.throws(() => executePortfolioUiTool({ name, input: {} }, {}), /지원하지 않는/u);
  }
});

test('실제 WebMCP 등록은 11개 일반 도구뿐이며 setter들이 같은 실행기로 전달된다', async t => {
  const source = readFileSync(new URL('../webmcp/PortfolioWebMcpTools.tsx', import.meta.url), 'utf8');
  const ts = createRequire(import.meta.url)('typescript');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText;
  const registrations = [], commands = [], effects = [];
  let cleanup;
  const exports = {};
  const dependencies = {
    react: { useEffect(effect) { cleanup = effect(); } },
    '@/features/chat': { useChat: () => ({ executePortfolioUiTool: command => {
      commands.push(command);
      return { ok: true };
    } }) },
    '@/features/portfolio-tools/schema': { PORTFOLIO_UI_TOOL_NAMES, PORTFOLIO_UI_TOOLS },
  };
  const document = { modelContext: { async registerTool(tool, options) {
    registrations.push(tool); effects.push(options.signal);
  } } };
  new Function('require', 'exports', 'document', 'process', compiled)(name => {
    assert.ok(Object.hasOwn(dependencies, name), name);
    return dependencies[name];
  }, exports, document, { env: { NODE_ENV: 'test' } });
  exports.PortfolioWebMcpTools();
  t.after(() => cleanup?.());
  for (let index = 0; index < 30 && registrations.length < PORTFOLIO_UI_TOOL_NAMES.length; index++) await Promise.resolve();
  assert.deepEqual(registrations.map(tool => tool.name), PORTFOLIO_UI_TOOL_NAMES);
  assert.ok(registrations.every(tool => !tool.name.includes('cycle')));
  for (const [name, input] of [...accentEntries, ...sizeEntries]) {
    const result = await registrations.find(tool => tool.name === name).execute(input);
    assert.equal(JSON.parse(result.content[0].text).ok, true);
  }
  assert.deepEqual(commands.map(({ name, input }) => [name, input]), [...accentEntries, ...sizeEntries]);
  assert.ok(commands.every(command => command.signal === effects[0]));
  cleanup();
  assert.equal(effects[0].aborted, true);
});

test('실제 Provider와 공통 실행기는 색상·크기를 각각 확인하고 마지막 값을 유지한다', async t => {
  for (const streaming of [false, true]) {
    for (const [label, entries] of [['색상6', accentEntries], ['크기4', sizeEntries],
      ['반복 setter20', [...accentEntries, ...sizeEntries, ...accentEntries, ...sizeEntries]]]) {
      await t.test(`${streaming ? 'SSE' : 'JSON'} ${label}`, async t => {
        const fixture = sequenceCase(entries);
        const originalNative = structuredClone(fixture.native);
        const applied = [];
        const f = providerReportFixture(t, { fixture, streaming, duplicateTools: true,
          executeUiTool: actualSettingsExecutor((command, state) => applied.push({
            name: command.name, input: structuredClone(command.input), settings: structuredClone(state.uiSettings),
          })),
          reportOutcomes: entries.length === 20 ? [{ error: new ChatApiError('report timeout', { code: 'timeout' }) }] : [],
        });
        f.state.uiSettings.accent = 'rose';
        await f.run();
        assert.deepEqual(f.state.effects, entries);
        assert.deepEqual(applied.map(({ name, input }) => [name, input]), entries);
        assert.equal(f.state.requests.filter(item => !item.toolVerification).length, 1);
        const report = f.state.reportRequests[0];
        assert.equal(f.state.reportRequests.length, entries.length === 20 ? 2 : 1);
        assert.deepEqual(report.toolTask.steps, fixture.steps);
        assert.equal(report.toolTask.steps.length, entries.length * 2);
        assert.equal(report.toolTask.generation, 1);
        assert.deepEqual(report.toolVerification.results.map(item => item.toolCallId), fixture.calls.map(call => call.id));
        assert.deepEqual(report.toolVerification.results.map(item => item.stepIndex), entries.map((_, index) => index * 2));
        assert.ok(report.toolVerification.results.every(item => item.status === 'applied'));
        assert.deepEqual(report.toolHistory[0].tool_calls, fixture.calls);
        assert.deepEqual(fixture.native, originalNative);
        assert.equal(Object.isFrozen(report), true);
        if (entries.length === 20) assert.deepEqual(f.state.reportRequests[1], report);
        for (const [name, key, field] of [['set_portfolio_accent', 'accent', 'accent'],
          ['set_portfolio_chat_font_size', 'size', 'chatFontSize']]) {
          const last = entries.findLast(entry => entry[0] === name);
          if (last) {
            assert.equal(f.state.uiSettings[field], last[1][key]);
            assert.equal(report.uiSettings[field], last[1][key]);
          }
        }
        assert.equal(f.state.messages.at(-1).toolTaskProgress.status, 'completed');
        assert.equal(f.state.messages.at(-1).toolTaskProgress.steps.filter(step => step.state === 'applied').length, entries.length);
      });
    }
  }
});

test('setter 순회 중 중단하면 남은 호출과 자동 원복을 실행하지 않는다', async t => {
  for (const streaming of [false, true]) await t.test(streaming ? 'SSE' : 'JSON', async t => {
    let f;
    f = providerReportFixture(t, { fixture: sequenceCase(accentEntries), streaming,
      executeUiTool: actualSettingsExecutor((_command, state) => { if (state.effects.length === 3) f.stop(); }),
    });
    f.state.uiSettings.accent = 'rose';
    await f.run();
    assert.deepEqual(f.state.effects, accentEntries.slice(0, 3));
    assert.equal(f.state.uiSettings.accent, 'emerald');
    assert.equal(f.state.reportRequests.length, 0);
    assert.equal(f.state.messages.at(-1).generationState, 'stopped');
  });
});

test('같은 setter의 native 21개는 일부 실행하거나 잘라내지 않고 task-v1에서 거부한다', () => {
  const fixture = sequenceCase(Array.from({ length: 21 }, (_, index) => accentEntries[index % ACCENTS.length]));
  const executions = fixture.executions.filter(item => item.toolTask.source === 'native')
    .map((item, stepIndex) => ({ ...item, toolTask: { ...item.toolTask, stepIndex } }));
  assert.throws(() => parseChatResponse({ mode: 'model', status: 'online', generated: true, answer: '',
    segments: [], actions: [], suggestedQuestions: [], audience: 'default', tone: 'official', pageContext: 'overview',
    cached: false, toolExecutions: executions,
    toolTask: { ...fixture.scope, steps: executions.map(stepFromExecution), dispatchComplete: true, status: 'awaiting_browser' },
  }, fixture.request), ToolTaskProtocolError);
});

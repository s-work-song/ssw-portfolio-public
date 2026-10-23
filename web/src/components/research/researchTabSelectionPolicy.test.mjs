import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { researchTabSelectionRequest } from './researchTabSelectionPolicy.ts';

test('Radix 입력과 뒤따르는 click은 확정 전 같은 선택 요청 하나로 합친다', () => {
  const pending = researchTabSelectionRequest('overview', 'optimization', null);
  assert.deepEqual(pending, { activeTab: 'overview', targetTab: 'optimization' });
  assert.equal(researchTabSelectionRequest('overview', 'optimization', pending), null);
  assert.equal(researchTabSelectionRequest('overview', 'overview', pending), null);
});

test('확정 전 다른 목표는 허용하고 가장 최근 목표의 중복만 차단한다', () => {
  const first = researchTabSelectionRequest('optimization', 'cpu', null);
  const next = researchTabSelectionRequest('optimization', 'memory', first);
  assert.deepEqual(next, { activeTab: 'optimization', targetTab: 'memory' });
  assert.equal(researchTabSelectionRequest('optimization', 'memory', next), null);
  assert.deepEqual(researchTabSelectionRequest('optimization', 'cpu', next), first);
});

test('활성 탭이 확정되면 새 선택을 허용하고 이미 활성인 탭은 선택하지 않는다', () => {
  const pending = { activeTab: 'cpu', targetTab: 'memory' };
  assert.equal(researchTabSelectionRequest('memory', 'memory', pending), null);
  assert.deepEqual(researchTabSelectionRequest('memory', 'cpu', pending), {
    activeTab: 'memory', targetTab: 'cpu',
  });
  assert.deepEqual(researchTabSelectionRequest('cpu', 'memory', null), pending);
});

test('탭은 controlled manual Radix 탐색과 기존 DOM 클릭 계약을 함께 유지한다', async () => {
  const source = await readFile(new URL('./ResearchTabs.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \* as Tabs from '@radix-ui\/react-tabs'/);
  assert.match(source, /<Tabs\.Root asChild value=\{activeTab\} onValueChange=\{requestSelect\} activationMode="manual">/);
  assert.match(source, /<Tabs\.List asChild loop=\{true\}>/);
  assert.match(source, /<Tabs\.Trigger key=\{tab\.id\} asChild value=\{tab\.id\}>/);
  assert.match(source, /tabs\.find\(\(tab\) => tab\.id === value\)\?\.id/);
  assert.match(source, /if \(!targetTab\) return/);
  assert.match(source, /onClick=\{\(\) => requestSelect\(tab\.id\)\}/);
  assert.match(source, /useEffect\(\(\) => \{\s*pendingSelectionRef\.current = null;\s*\}, \[activeTab\]\)/);
  assert.doesNotMatch(source, /<Tabs\.Content|forceMount|onKeyDown=|onMouseDown=|window\.|document\.|as ResearchTabId/);
  for (const contract of [
    '<nav', '<button', 'role="tablist"', 'role="tab"',
    'id={`${tabIdPrefix}-${tab.id}`}', 'aria-selected={isActive}',
    'aria-controls={`${panelIdPrefix}-${tab.id}`}',
    'data-chat-action-research-tab-target=', 'actionTargetTab === tab.id',
    '<span aria-hidden="true">{tab.emoji}</span>', '<span>{tab.label}</span>',
    "tabIdPrefix = 'research-tab'", "panelIdPrefix = 'research-panel'",
    "variant = 'primary'", "variant === 'secondary'",
  ]) assert.ok(source.includes(contract), contract);
});

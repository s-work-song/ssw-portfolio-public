import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { SettingsRadioKeyboardSelection } from './settingsRadioKeyboardPolicy.ts';

const source = await readFile(new URL('./page.tsx', import.meta.url), 'utf8');
const file = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const attribute = (opening, name) => opening.attributes.properties.find((part) => ts.isJsxAttribute(part) && part.name.getText(file) === name);
const value = (opening, name) => attribute(opening, name)?.initializer?.getText(file);
const elements = [];
const visit = (node) => {
  if (ts.isJsxElement(node)) elements.push(node);
  ts.forEachChild(node, visit);
};
visit(file);
const groups = elements.filter((element) => value(element.openingElement, 'role') === '"radiogroup"');
const radios = elements.filter((element) => value(element.openingElement, 'role') === '"radio"');
const rootValues = {
  'theme-mode': 'mode', motion: 'motion', 'page-transition': 'pageTransition', accent: 'accent',
  'fab-mode': 'fabMode', 'quick-menu-animation': 'fabAnim', 'chat-layout': 'chatLayout',
  'chat-font': 'chatFont', 'chat-font-size': 'chatFontSize', 'chat-text-animation': 'streamAnimation',
  'chat-panel-animation': 'chatAnimation',
};
const setters = {
  'theme-mode': 'setMode', motion: 'setMotion', 'page-transition': 'setPageTransition', accent: 'setAccent',
  'fab-mode': 'setFabMode', 'quick-menu-animation': 'setFabAnim', 'chat-layout': 'setChatLayout',
  'chat-font': 'setChatFont', 'chat-font-size': 'setChatFontSize', 'chat-text-animation': 'setStreamAnimation',
  'chat-panel-animation': 'setChatAnimation',
};
const itemsOf = (group) => radios.filter((radio) => radio.getStart(file) > group.getStart(file) && radio.end < group.end);
const arrow = (key = 'ArrowRight', modifiers = {}) => ({ key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...modifiers });

test('정상 Radix 클릭이 먼저 발생하면 방향키 보완 클릭은 실행하지 않는다', () => {
  const bridge = new SettingsRadioKeyboardSelection();
  bridge.begin(arrow(), 'old');
  bridge.cancel(); // Root click capture는 내부 onFocus.click을 먼저 관찰한다.
  assert.equal(bridge.consumeFocus('next'), false);
});

test('keyup 경합으로 클릭이 빠지면 새 포커스에 보완 클릭을 한 번만 허용한다', () => {
  const bridge = new SettingsRadioKeyboardSelection();
  bridge.begin(arrow(), 'old');
  assert.equal(bridge.consumeFocus('old'), false);
  assert.equal(bridge.consumeFocus('next'), true);
  assert.equal(bridge.consumeFocus('next'), false);
});

test('Home·End·Space·Enter·Tab 및 수정 키에는 방향키 선택 요청을 만들지 않는다', () => {
  for (const key of ['Home', 'End', ' ', 'Enter', 'Tab', 'a']) {
    const bridge = new SettingsRadioKeyboardSelection();
    assert.equal(bridge.begin(arrow(key), 'old'), null);
    assert.equal(bridge.consumeFocus('next'), false);
  }
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
    const bridge = new SettingsRadioKeyboardSelection();
    assert.equal(bridge.begin(arrow('ArrowRight', { [modifier]: true }), 'old'), null);
  }
});

test('네 방향키를 허용하고 오래된 cleanup이 새 요청을 지우지 않는다', () => {
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
    const bridge = new SettingsRadioKeyboardSelection();
    const first = bridge.begin(arrow(key), 'old');
    const latest = bridge.begin(arrow(key), 'new');
    bridge.expire(first);
    assert.equal(bridge.consumeFocus('next'), true);
    bridge.expire(latest);
    assert.equal(bridge.consumeFocus('next'), false);
  }
});

test('포인터·그룹 밖 포커스·비방향키·같은 요청의 cleanup은 오래된 선택을 취소한다', () => {
  const bridge = new SettingsRadioKeyboardSelection();
  const token = bridge.begin(arrow(), 'old');
  bridge.expire(token);
  assert.equal(bridge.consumeFocus('next'), false);
  bridge.begin(arrow(), 'old');
  bridge.cancel();
  assert.equal(bridge.consumeFocus('next'), false);
  bridge.begin(arrow(), 'old');
  bridge.begin(arrow('Home'), 'old');
  assert.equal(bridge.consumeFocus('next'), false);
});

test('그룹 연결은 Radix 포커스·기존 클릭을 유지하며 전역 리스너를 추가하지 않는다', async () => {
  const wrapper = await readFile(new URL('./SettingsRadioGroup.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ SettingsRadioGroup, SettingsRadioItem \} from "\.\/SettingsRadioGroup"/);
  assert.match(wrapper, /return <Root/);
  assert.match(wrapper, /onClickCapture=/);
  assert.match(wrapper, /target\.click\(\)/);
  assert.match(wrapper, /selectionRef\.current\.consumeFocus\(target\)/);
  assert.match(wrapper, /onPointerDownCapture=/);
  assert.match(wrapper, /event\.currentTarget\.contains\(next\)/);
  assert.doesNotMatch(wrapper, /document\.addEventListener|\.focus\(|<div|<button|onValueChange=/);
});

test('설정의 12개 단일 선택 그룹은 기존 외부 상태를 controlled Radix 값으로 받는다', () => {
  assert.equal(groups.length, 12);
  assert.equal(radios.length, 16); // map으로 늘어나는 옵션의 JSX 템플릿 수다.
  for (const group of groups) {
    const opening = group.openingElement;
    assert.equal(opening.tagName.getText(file), 'SettingsRadioGroup');
    assert.ok(attribute(opening, 'aria-label') || attribute(opening, 'aria-labelledby'));
    assert.ok(attribute(opening, 'style'));
    assert.equal(attribute(opening, 'defaultValue'), undefined);
    assert.equal(attribute(opening, 'onValueChange'), undefined);
    const first = itemsOf(group)[0].openingElement;
    const option = value(first, 'data-option');
    if (option) {
      assert.equal(value(opening, 'value'), `{${rootValues[JSON.parse(option)]}}`);
    } else {
      assert.equal(value(opening, 'aria-label'), '"미리보기 재생 속도"');
      assert.equal(value(opening, 'value'), '{String(streamPreviewSpeed)}');
    }
  }
});

test('라디오 Item은 기존 setter·선택 상태·스타일·제어 data 표식을 유지한다', () => {
  for (const radio of radios) {
    const opening = radio.openingElement;
    assert.equal(opening.tagName.getText(file), 'SettingsRadioItem');
    assert.ok(attribute(opening, 'onClick'));
    assert.ok(attribute(opening, 'aria-checked'));
    assert.ok(attribute(opening, 'style'));
    const optionText = value(opening, 'data-option');
    if (optionText) {
      const option = JSON.parse(optionText);
      assert.ok(attribute(opening, 'className'));
      assert.equal(value(opening, 'value'), value(opening, 'data-value'));
      assert.ok(value(opening, 'onClick').includes(setters[option]));
    } else {
      assert.equal(value(opening, 'value'), '{String(option.value)}');
      assert.ok(value(opening, 'onClick').includes('setStreamPreviewSpeed(option.value)'));
    }
  }
});

test('미리보기 속도는 숫자 상태를 유지하고 스위치·초기화·슬라이더는 이번 범위에서 제외한다', () => {
  const switches = elements.filter((element) => value(element.openingElement, 'role') === '"switch"');
  assert.equal(switches.length, 2);
  for (const element of switches) assert.equal(element.openingElement.tagName.getText(file), 'button');
  assert.match(source, /onClick=\{resetAllSettings\}/);
  assert.match(source, /id="chat-dock-width"/);
  assert.match(source, /useState<StreamPreviewSpeed>\(1\)/);
  assert.doesNotMatch(source, /onKeyDown=|document\.addEventListener|as ThemeMode|as Motion|as Accent/);
});

test('Radix 컨트롤 버전·공개 라이선스와 기존 설정 CSS 계약을 함께 유지한다', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8'));
  const lock = JSON.parse(await readFile(new URL('../../../../package-lock.json', import.meta.url), 'utf8'));
  for (const [name, version] of [['@radix-ui/react-tabs', '1.1.21'], ['@radix-ui/react-radio-group', '1.4.7']]) {
    assert.equal(manifest.dependencies[name], version);
    assert.equal(lock.packages.web.dependencies[name], version);
    assert.equal(lock.packages[`node_modules/${name}`].version, version);
  }
  const notice = await readFile(new URL('../../../public/licenses/radix-controls-LICENSES.txt', import.meta.url), 'utf8');
  assert.match(notice, /@radix-ui\/react-tabs@1\.1\.21/);
  assert.match(notice, /@radix-ui\/react-radio-group@1\.4\.7/);
  assert.match(notice, /MIT License/);
  assert.match(notice, /Copyright \(c\) 2022 WorkOS/);
  const css = await readFile(new URL('./page.module.css', import.meta.url), 'utf8');
  for (const option of Object.keys(rootValues)) assert.ok(css.includes(`[data-option="${option}"]`), option);
});

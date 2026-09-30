import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ACCENTS } from '../src/context/accentPalette.ts';

const css = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8');
function tokens(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, selector);
  const block = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)]
    .map(([, key, value]) => [key, value.trim()]));
}

test('차가운 회색 무광 다크 토큰을 적용하고 라이트 기본 표면은 보존한다', () => {
  const light = tokens(':root');
  assert.deepEqual(['--bg', '--bg-elev', '--bg-elev-2', '--text', '--text-dim', '--text-mute', '--accent']
    .map((key) => light[key]), ['#f4f5fb', '#ffffff', '#f3f4fa', '#14161f', '#525872', '#666d85', '#6366f1']);
  assert.equal(light['--shadow'], '0 22px 50px -28px rgba(20,24,60,0.20)');
  assert.equal(light['--surface-fill'], undefined);
  assert.equal(light['--surface-pattern-opacity'], undefined);
  const dark = tokens("[data-theme='dark']");
  assert.deepEqual(['--bg', '--bg-elev', '--bg-elev-2', '--text', '--border', '--nav-bg']
    .map((key) => dark[key]), ['#111315', '#1b1e22', '#24282d', '#edf0f3', '#34383e', '#111315']);
  for (const key of ['--bg', '--bg-elev', '--bg-elev-2', '--text', '--text-dim', '--text-mute', '--border', '--border-strong']) {
    const [r, g, b] = [1, 3, 5].map((offset) => Number.parseInt(dark[key].slice(offset, offset + 2), 16));
    assert.ok(r <= g && g <= b && b - r <= 16, `${key}: 차가운 저채도 회색`);
  }
  assert.equal(dark['--shadow'], 'none');
  assert.equal(dark['--surface-fill'], 'var(--bg-elev-2)');
  assert.equal(dark['--surface-pattern-opacity'], '0');
});

test('블루 표현은 다크 기본 인디고에만 한정하고 저장 팔레트 값은 유지한다', () => {
  const darkAccent = tokens(":root[data-theme='dark']:is([data-accent='indigo'], :not([data-accent]))");
  assert.equal(darkAccent['--accent'], '#326bd3 !important');
  assert.equal(darkAccent['--accent-contrast'], '#ffffff !important');
  assert.deepEqual(Object.values(ACCENTS).map((palette) => palette.color),
    ['#6366f1', '#059669', '#d97706', '#e11d48', '#7c3aed']);
});

function luminance(hex) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test('다크 본문·보조 글자와 블루 버튼 글자는 4.5 이상 대비를 확보한다', () => {
  const dark = tokens("[data-theme='dark']");
  const pairs = ['--text', '--text-dim', '--text-mute']
    .flatMap((text) => ['--bg', '--bg-elev', '--bg-elev-2'].map((background) => [dark[text], dark[background]]));
  pairs.push(['#ffffff', '#326bd3']);
  for (const [foreground, background] of pairs) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, `${foreground} / ${background}`);
  }
});

test('채팅·둘러보기·미디어의 평면 표면은 다크 선택자로 제한한다', async () => {
  for (const path of [
    '../src/features/chat/ChatWidget.module.css',
    '../src/features/chat/GuidedTourCard.module.css',
    '../src/components/about/ProjectMediaCarousel.module.css',
    '../src/components/about/AgentExperimentGallery.module.css',
  ]) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /:global\(:root\[data-theme='dark'\]\)[^{]+\{[^}]*box-shadow:\s*none/);
  }
  const chat = await readFile(new URL('../src/features/chat/ChatWidget.module.css', import.meta.url), 'utf8');
  assert.match(chat, /:global\(:root\[data-theme='dark'\]\)[^{]*\.composer button[^}]*color: var\(--accent-contrast\)/);
});

test('둘러보기 본문은 기본 채팅 크기와 본문 대비를 쓰고 종료 후 변형을 남기지 않는다', async () => {
  const tour = await readFile(new URL('../src/features/chat/GuidedTourCard.module.css', import.meta.url), 'utf8');
  assert.match(tour, /\.message,\s*\.instruction\s*\{[^}]*color:\s*var\(--chat-text\);[^}]*font-size:\s*14px;[^}]*font-weight:\s*500;/u);
  for (const name of ['tour-enter', 'tour-panel-reveal']) {
    assert.match(tour, new RegExp(`animation:\\s*${name}[^;]*\\bbackwards;`, 'u'));
    const keyframes = tour.slice(tour.indexOf(`@keyframes ${name}`));
    assert.match(keyframes, /^@keyframes[^]*?to\s*\{[^}]*transform:\s*none;/u);
  }
  const chat = await readFile(new URL('../src/features/chat/ChatWidget.module.css', import.meta.url), 'utf8');
  const dock = chat.match(/\.panelDocked\s*\{([^}]+)\}/u)?.[1];
  assert.ok(dock);
  assert.doesNotMatch(dock, /will-change\s*:/u);
  for (const name of ['desktopDockIn', 'desktopPanelIn']) {
    assert.match(chat, new RegExp(`animation:\\s*${name}[^;]*\\bbackwards;`, 'u'));
    const keyframes = chat.slice(chat.indexOf(`@keyframes ${name}`));
    assert.match(keyframes, /^@keyframes[^]*?to\s*\{[^}]*transform:\s*none;/u);
  }
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ACCENTS, DEFAULT_ACCENT } from '../src/context/accentPalette.ts';
import { ACCENTS as ACCENT_KEYS } from '../src/features/portfolio-tools/settings.ts';

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
    .map((key) => light[key]), ['#f4f5fb', '#ffffff', '#f3f4fa', '#14161f', '#525872', '#666d85', '#4169e1']);
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

test('로얄블루를 첫 옵션과 공통 기본색으로 쓰고 인디고의 다크 덮어쓰기를 제거한다', async () => {
  assert.equal(DEFAULT_ACCENT, 'blue');
  assert.equal(ACCENT_KEYS[0], 'blue');
  assert.equal(ACCENTS.blue.label, '로얄블루');
  assert.deepEqual(Object.keys(ACCENTS), [...ACCENT_KEYS]);
  const light = tokens(':root');
  for (const [token, key] of [['--accent', 'color'], ['--accent-2', 'color2'], ['--accent-soft', 'soft'], ['--accent-contrast', 'contrast']]) {
    assert.equal(light[token], ACCENTS.blue[key]);
    assert.equal(tokens("[data-theme='dark']")[token], undefined);
  }
  assert.doesNotMatch(css, /data-accent='indigo'/u);
  const settingsCss = await readFile(new URL('../src/app/settings/page.module.css', import.meta.url), 'utf8');
  assert.ok(settingsCss.includes(':global(:root[data-accent="blue"]) .optOn[data-option="accent"][data-value="blue"]'));
  assert.deepEqual(Object.values(ACCENTS).map((palette) => palette.color),
    ['#4169e1', '#6366f1', '#059669', '#d97706', '#e11d48', '#7c3aed']);
});

function luminance(hex) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test('공통 패널은 화이트·쿨그레이 조합이며 양쪽 테마의 설명·네트워크 글자 대비를 유지한다', () => {
  const light = tokens(':root');
  const dark = tokens("[data-theme='dark']");
  const contrast = (a, b) => {
    const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (values[0] + .05) / (values[1] + .05);
  };
  assert.equal(light['--panel-bg'], '#ffffff');
  assert.equal(light['--panel-card-bg'], '#f6f8fc');
  assert.equal(light['--panel-inset-bg'], light['--panel-card-bg']);
  assert.ok(contrast(light['--panel-border'], light['--panel-bg']) >= 1.3);
  for (const theme of [light, dark]) {
    for (const surface of ['--panel-bg', '--panel-card-bg', '--panel-inset-bg']) {
      for (const foreground of ['--text', '--text-dim', '--network-color']) {
        assert.ok(contrast(theme[foreground], theme[surface]) >= 4.5, `${foreground} / ${surface}`);
      }
    }
  }
});

test('화이트 공통 배경 안의 활용 단계 카드와 배포 노드는 쿨그레이 토큰으로 구분한다', async () => {
  const preview = await readFile(new URL('../src/components/about/AiWorkflowPreview.module.css', import.meta.url), 'utf8');
  assert.match(preview, /\.stages a\s*\{[^}]*background:\s*var\(--panel-card-bg\)/u);
  assert.match(preview, /:global\(:root:not\(\[data-theme='dark'\]\)\) \.preview\s*\{[^}]*border-top:\s*3px solid var\(--accent\)/u);
  const diagram = await readFile(new URL('../src/components/about/PortfolioDeploymentDiagram.module.css', import.meta.url), 'utf8');
  assert.match(diagram, /\.node rect\s*\{[^}]*fill:\s*var\(--panel-card-bg\)/u);
  const dark = tokens("[data-theme='dark']");
  assert.equal(dark['--panel-bg'], '#24282d');
  assert.equal(dark['--panel-card-bg'], dark['--bg-elev']);
});

test('안내·미리보기·다이어그램 표면은 하나의 테마 토큰을 공유한다', async () => {
  for (const [file, selector] of [
    ['SiTerminologyNotice', '.notice'],
    ['AiWorkflowPreview', '.preview'],
    ['DevelopmentEnvironmentOverview', '.diagramPanel'],
    ['DeploymentDiagramCarousel', '.frame'],
    ['AgentExperimentGallery', '.introPanel'],
  ]) {
    const source = await readFile(new URL(`../src/components/about/${file}.module.css`, import.meta.url), 'utf8');
    const start = source.search(new RegExp(`(?:^|\n)${selector.replaceAll('.', '\\.')} \\{`));
    assert.notEqual(start, -1, file);
    const block = source.slice(start).split('}')[0];
    assert.match(block, /background:\s*var\(--panel-bg\)/, file);
    assert.match(block, /border:\s*1px solid var\(--panel-border\)/, file);
  }
});

test('큰 패널은 강조색이 아닌 중립색이며 환경·설명·선택 탭은 역할별 표면을 구분한다', async () => {
  for (const theme of [tokens(':root'), tokens("[data-theme='dark']")]) {
    const channels = [1, 3, 5].map(offset => Number.parseInt(theme['--panel-bg'].slice(offset, offset + 2), 16));
    assert.ok(Math.max(...channels) - Math.min(...channels) <= 10);
    assert.notEqual(theme['--diagram-personal-bg'], theme['--diagram-external-bg']);
    assert.notEqual(theme['--panel-inset-bg'], theme['--panel-bg']);
  }
  const diagram = await readFile(new URL('../src/components/about/DevelopmentEnvironmentDiagram.module.css', import.meta.url), 'utf8');
  assert.match(diagram, /\.personal rect\s*\{[^}]*var\(--diagram-personal-bg\)/u);
  assert.match(diagram, /\.external rect, \.externalTailnet rect\s*\{[^}]*var\(--diagram-external-bg\)/u);
  assert.match(diagram, /\.node\[data-environment-node='Grok'\] > rect\s*\{[^}]*var\(--diagram-external-node-bg\)/u);
  for (const selector of ['history', 'notes']) {
    assert.match(diagram, new RegExp(`\\.${selector} \\{[^}]*background: var\\(--panel-inset-bg\\)`, 'u'));
  }
  const tabs = await readFile(new URL('../src/components/about/ArchitectureTabs.module.css', import.meta.url), 'utf8');
  assert.match(tabs, /\.tabList\s*\{[^}]*background:\s*var\(--panel-bg\)/u);
  assert.match(tabs, /\.tab\[data-state='active'\]\s*\{[^}]*color:\s*var\(--accent-contrast\)[^}]*background:\s*var\(--accent\)/u);
});

test('설명·캡션 크기는 공통 토큰을 쓰며 모바일에서도 작은 크기로 덮어쓰지 않는다', async () => {
  const light = tokens(':root');
  assert.equal(light['--font-size-description'], '.9rem');
  assert.equal(light['--font-size-caption'], '.875rem');
  for (const [file, selectors] of [
    ['SiTerminologyNotice', ['.content p']],
    ['AiWorkflowPreview', ['.stageDescription', '.footer p']],
    ['DevelopmentEnvironmentDiagram', ['.lead', '.history p', '.notes']],
    ['DeploymentOverview', ['.projectDescription', '.boundaryNote']],
    ['DeploymentDiagramCarousel', ['.header p']],
    ['MermaidDiagram', ['.description']],
    ['InfrastructureMigration', ['.reasons p', '.stepDescription']],
    ['DeploymentMemoryHistory', ['.scope', '.serviceTable']],
  ]) {
    const source = await readFile(new URL(`../src/components/about/${file}.module.css`, import.meta.url), 'utf8');
    for (const selector of selectors) {
      const block = source.slice(source.indexOf(`${selector} {`)).split('}')[0];
      assert.match(block, /font-size:\s*var\(--font-size-description\)/, `${file} ${selector}`);
    }
    if (file === 'DevelopmentEnvironmentDiagram') {
      assert.doesNotMatch(source, /\.lead,\s*\.history p,\s*\.notes\s*\{[^}]*font-size:/);
    }
  }
});

test('설정의 색 이름과 옵션 안내에 실제 팔레트의 대문자 HEX 코드를 표시한다', async () => {
  const source = await readFile(new URL('../src/app/settings/page.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('label: `${ACCENTS[key].label} (${ACCENTS[key].color.toUpperCase()})`'));
  assert.ok(source.includes('aria-label={`${meta.label} (${meta.color.toUpperCase()})`}'));
  assert.ok(source.includes('title={`${meta.label} (${meta.color.toUpperCase()})`}'));
});

test('다크 본문·보조 글자와 블루 버튼 글자는 4.5 이상 대비를 확보한다', () => {
  const dark = tokens("[data-theme='dark']");
  const pairs = ['--text', '--text-dim', '--text-mute']
    .flatMap((text) => ['--bg', '--bg-elev', '--bg-elev-2'].map((background) => [dark[text], dark[background]]));
  pairs.push(['#ffffff', ACCENTS.blue.color]);
  for (const [foreground, background] of pairs) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, `${foreground} / ${background}`);
  }
});

test('반전 이동 버튼은 강조색 글자 규칙에서 제외하고 라이트·다크 대비를 유지한다', async () => {
  assert.match(css, /:root\[data-theme='dark'\] \.hover-btn-primary:not\(\.hover-btn-inverse\)\s*\{[^}]*color:\s*var\(--accent-contrast\) !important;/);
  assert.doesNotMatch(css, /:root\[data-theme='dark'\] \.hover-btn-primary\s*\{[^}]*color:/);
  const darkHover = css.match(/:root\[data-theme='dark'\] \.hover-btn-primary:hover\s*\{([^}]+)\}/)?.[1];
  assert.ok(darkHover);
  assert.doesNotMatch(darkHover, /color:/);
  for (const path of [
    '../src/app/about-me/page.tsx',
    '../src/app/about-me/resume/page.tsx',
    '../src/app/about-me/cover-letter/page.tsx',
    '../src/app/about-me/log/page.tsx',
    '../src/components/ResearchViewer.tsx',
  ]) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    const styles = source.match(/className="hover-btn-primary hover-btn-inverse" style=\{\{([\s\S]*?)\}\}/)?.[1];
    assert.ok(styles, path);
    assert.match(styles, /background: 'var\(--text\)'/);
    assert.match(styles, /color: 'var\(--bg\)'/);
    assert.equal((source.match(/hover-btn-inverse/g) ?? []).length, 1, path);
  }
  for (const selector of [':root', "[data-theme='dark']"]) {
    const theme = tokens(selector);
    const values = [luminance(theme['--bg']), luminance(theme['--text'])].sort((a, b) => b - a);
    assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, selector);
  }
});

test('다크 반전 버튼에만 포인트 색을 옅게 섞고 모든 팔레트에서 글자 대비를 유지한다', () => {
  const inverse = css.match(/:root\[data-theme='dark'\] \.hover-btn-inverse\s*\{([^}]+)\}/)?.[1];
  assert.ok(inverse);
  assert.match(inverse, /background:\s*color-mix\(in srgb, var\(--accent\) 14%, var\(--text\)\) !important;/);
  assert.doesNotMatch(inverse, /color:/);
  const dark = tokens("[data-theme='dark']");
  for (const palette of Object.entries(ACCENTS)) {
    const accent = palette[1].color;
    const background = '#' + [1, 3, 5].map((offset) => Math.round(
      Number.parseInt(accent.slice(offset, offset + 2), 16) * .14
      + Number.parseInt(dark['--text'].slice(offset, offset + 2), 16) * .86,
    ).toString(16).padStart(2, '0')).join('');
    const values = [luminance(dark['--bg']), luminance(background)].sort((a, b) => b - a);
    assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, palette[0]);
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

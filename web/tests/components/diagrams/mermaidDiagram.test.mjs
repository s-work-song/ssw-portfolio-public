import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const component = await readFile(new URL('../../../src/components/diagrams/MermaidDiagram.tsx', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8'));
const vendorScript = await readFile(new URL('../../../scripts/vendor-mermaid.mjs', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);

test('Tiny browser IIFE is self-hosted with the exact pinned version and Pages base path', () => {
  assert.equal(packageJson.dependencies['@mermaid-js/tiny'], '12.1.0');
  assert.match(component, /process\.env\.NEXT_PUBLIC_BASE_PATH \?\? ''/u);
  assert.match(component, /\/vendor\/mermaid\/mermaid\.tiny-12\.1\.0\.js/u);
  assert.doesNotMatch(component, /https?:\/\/|import\(['"]@mermaid/u);
  assert.match(vendorScript, /copyFile\(require\.resolve\('@mermaid-js\/tiny'\)/u);
  for (const script of ['predev', 'predev:lan', 'prebuild']) {
    assert.equal(packageJson.scripts[script], 'node scripts/vendor-mermaid.mjs');
  }
});

test('diagram loads near the viewport, serializes rendering, and uses strict SVG labels', () => {
  assert.match(component, /new IntersectionObserver/u);
  assert.match(component, /nearViewport &&/u);
  // A second component can attach while the same Script URL is still loading.
  // Next's duplicate-source path resolves onLoad; cached remounts use onReady.
  assert.match(component, /onLoad=\{\(\) => setEngineReady\(true\)\}/u);
  assert.match(component, /onReady=\{\(\) => setEngineReady\(true\)\}/u);
  assert.match(component, /rendering = rendering\.catch/u);
  assert.match(component, /securityLevel: 'strict'/u);
  assert.match(component, /htmlLabels: false/u);
  assert.match(component, /await document\.fonts\.ready/u);
  assert.doesNotMatch(component, /bindFunctions|securityLevel: 'loose'/u);
});

test('compact source, live theme changes, description and failure fallback are preserved', () => {
  assert.match(component, /max-width: 760px/u);
  assert.match(component, /compact\.matches && compactDiagram \? compactDiagram : diagram/u);
  assert.match(component, /attributeFilter: \['data-theme', 'style'\]/u);
  assert.match(component, /aria-describedby=\{descriptionId\}/u);
  assert.match(component, /<ul id=\{descriptionId\}/u);
  assert.match(component, /description.split\('\\n'\).*<li key=\{line\}>\{line\}<\/li>/u);
  assert.match(component, /status === 'failed'/u);
  assert.match(component, /currentRevision !== revision/u);
  assert.doesNotMatch(component, /style\.minWidth|flowchart LR|scrollHint/u);
});

test('SVG is constrained to its panel rather than forcing horizontal scroll', async () => {
  const css = await readFile(new URL('../../../src/components/diagrams/MermaidDiagram.module.css', import.meta.url), 'utf8');
  assert.match(component, /rendered\.style\.maxWidth = '100%'/u);
  assert.match(css, /\.svg \{[^}]*min-width: 0;/u);
  assert.match(css, /\.svg :global\(svg\) \{[^}]*max-width: 100%;/u);
  assert.doesNotMatch(css, /min-width: fit-content|overflow-x: auto|!important/u);
});

test('캐러셀에는 준비 중이 아닌 SVG 완료 또는 실패 안내의 반영을 알린다', () => {
  assert.match(component, /onSettled\?: \(\) => void/u);
  assert.match(component, /if \(status !== 'waiting'\) onSettled\?\.\(\)/u);
  assert.match(component, /\[onSettled, status\]/u);
});

test('generated browser asset matches the installed package and license remains in static export', async () => {
  const source = await readFile(require.resolve('@mermaid-js/tiny'));
  const generated = await readFile(new URL('../../../public/vendor/mermaid/mermaid.tiny-12.1.0.js', import.meta.url));
  assert.deepEqual(generated, source);
  assert.match(source.toString('utf8').slice(-2400), /Bundled license information/u);
  const license = await readFile(new URL('../../../public/licenses/mermaid-LICENSE.txt', import.meta.url), 'utf8');
  assert.match(license, /Knut Sveidqvist/u);
  assert.match(license, /The MIT License/u);
});

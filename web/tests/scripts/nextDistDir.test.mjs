import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../../next.config.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS } }).outputText;
function configuration(env = {}, fs = require('node:fs')) {
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', 'process', compiled)(
    name => name === 'node:fs' ? fs : require(name), loaded, loaded.exports,
    { env, cwd: () => fileURLToPath(new URL('../../', import.meta.url)) });
  return loaded.exports.default;
}

test('Next 기본 출력은 .next를 유지하고 지정한 별도 산출물 경로만 선택한다', () => {
  assert.equal(configuration().distDir, '.next');
  for (const distDir of ['.diagnostics/next-isolated-build', '.diagnostics/next-client3001', '.next-fixture']) {
    const config = configuration({ SSW_NEXT_DIST_DIR: distDir });
    assert.equal(config.distDir, distDir);
    assert.equal(config.output, 'export');
    assert.equal(config.basePath, '');
  }
});

test('별도 출력은 절대경로·상위이동·기존 소스·임의 디렉터리·symlink를 허용하지 않는다', () => {
  for (const distDir of ['', '.', '..', '../build', '/tmp/build', 'C:/build', '.diagnostics/../src',
    '.diagnostics\\next-build', 'src', 'out', 'node_modules', '.diagnostics/next-build/extra', '.next-build\n']) {
    assert.throws(() => configuration({ SSW_NEXT_DIST_DIR: distDir }), /SSW_NEXT_DIST_DIR/u);
  }
  assert.throws(() => configuration({ SSW_NEXT_DIST_DIR: '.diagnostics/next-build' },
    { existsSync: () => true, lstatSync: () => ({ isSymbolicLink: () => true }) }), /symbolic link/u);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const { createBuildMkdir } = createRequire(import.meta.url)('../../scripts/windows-build-mkdir.cjs');
const root = resolve('fixture-build-output');
const target = join(root, 'page.segments', 'about-me', 'log');
const ancestor = join(root, 'page.segments', 'about-me');
const failure = (extra = {}) => Object.assign(new Error('fixture mkdir failure'), { code: 'EPERM', syscall: 'mkdir', path: ancestor, ...extra });
function fixture(overrides = {}) {
  const calls = []; const waits = []; let retries = 0; let recovered = 0;
  const mkdir = createBuildMkdir({ platform: 'win32', outputRoots: [root],
    mkdir: async (...args) => { calls.push(args); if (calls.length === 1) throw failure(); return 'created'; },
    stat: async () => ({ isDirectory: () => true }), realpath: async value => value,
    delay: async ms => { waits.push(ms); }, onRetry: () => { retries++; }, onRecovered: () => { recovered++; },
    ...overrides });
  return { mkdir, calls, waits, get retries() { return retries; }, get recovered() { return recovered; } };
}

test('Windows recursive mkdir retries only a now-existing output ancestor and preserves arguments/result', async () => {
  const f = fixture(); const options = { recursive: true, mode: 0o700 };
  assert.equal(await f.mkdir(target, options), 'created');
  assert.deepEqual(f.calls, [[target, options], [target, options]]);
  assert.deepEqual(f.waits, [10]);
  assert.equal(f.retries, 1); assert.equal(f.recovered, 1);
});

test('permanent EPERM is propagated after at most three retries without claiming recovery', async () => {
  const error = failure(); let calls = 0;
  const f = fixture({ mkdir: async () => { calls++; throw error; } });
  await assert.rejects(f.mkdir(target, { recursive: true }), value => value === error);
  assert.equal(calls, 4); assert.equal(f.retries, 3); assert.equal(f.recovered, 0);
  assert.deepEqual(f.waits, [10, 25, 50]);
});

test('an absent failed leaf may retry only after confirming its real allowed parent', async () => {
  const observed = [];
  const f = fixture({ stat: async directory => {
    observed.push(directory);
    if (directory === ancestor) throw Object.assign(new Error('not created yet'), { code: 'ENOENT' });
    return { isDirectory: () => true };
  } });
  assert.equal(await f.mkdir(target, { recursive: true }), 'created');
  assert.deepEqual(observed, [ancestor, join(root, 'page.segments')]);
  assert.equal(f.retries, 1);
});

test('Linux, non-recursive, different errors, outside paths, missing directories and symlink escape never retry', async () => {
  for (const overrides of [
    { platform: 'linux' },
    { mkdir: async () => { throw failure({ code: 'EACCES' }); } },
    { mkdir: async () => { throw failure({ syscall: 'open' }); } },
    { mkdir: async () => { throw failure({ path: resolve('outside') }); } },
    { stat: async () => ({ isDirectory: () => false }) },
    { stat: async () => { throw new Error('not found'); } },
    { realpath: async () => resolve('outside') },
  ]) {
    const f = fixture(overrides);
    await assert.rejects(f.mkdir(target, { recursive: true }));
    assert.equal(f.retries, 0); assert.equal(f.recovered, 0);
  }
  for (const [directory, options] of [[target, undefined], [target, { recursive: false }], [resolve('outside'), { recursive: true }]]) {
    const f = fixture(); await assert.rejects(f.mkdir(directory, options)); assert.equal(f.retries, 0);
  }
});

test('build launcher preserves Node options and CLI args while limiting the preload to Windows build children', () => {
  const require = createRequire(import.meta.url);
  const ts = require('typescript');
  const scriptUrl = new URL('../../scripts/next-build.mjs', import.meta.url);
  const source = readFileSync(scriptUrl, 'utf8').replaceAll('import.meta.url', JSON.stringify(scriptUrl.href));
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS } }).outputText;
  for (const platform of ['win32', 'linux']) {
    const spawned = [];
    const environment = { NODE_OPTIONS: '--max-old-space-size=4096', UNRELATED: 'kept' };
    const processFixture = { platform, env: environment, execPath: '/fixture/node', argv: ['node', 'script', '--webpack'],
      stderr: { write() {} } };
    const loaded = { exports: {} };
    new Function('require', 'module', 'exports', 'process', compiled)(
      name => name === 'node:child_process' ? { spawn: (...args) => { spawned.push(args); return { once() {} }; } } : require(name),
      loaded, loaded.exports, processFixture);
    const [executable, args, options] = spawned[0];
    assert.equal(executable, '/fixture/node');
    assert.deepEqual(args.slice(1), ['build', '--webpack']);
    assert.equal(options.env.UNRELATED, 'kept');
    assert.equal(environment.NODE_OPTIONS, '--max-old-space-size=4096');
    if (platform === 'win32') {
      assert.match(options.env.NODE_OPTIONS, /^--max-old-space-size=4096 --require=/u);
      assert.match(options.env.NODE_OPTIONS, /windows-build-mkdir\.cjs/u);
      assert.equal(options.env.SSW_NEXT_BUILD_FS_COMPAT, '1');
    } else assert.equal(options.env, environment);
  }
});

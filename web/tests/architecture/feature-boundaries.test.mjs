import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(file));
    else result.push(file);
  }
  return result;
}

test('채팅 루트에는 공개 진입점과 공통 계약만 남긴다', async () => {
  const root = path.join(projectRoot, 'src/features/chat');
  const names = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isFile()).map(entry => entry.name).sort();
  assert.deepEqual(names, ['constants.ts', 'index.ts', 'navigation.ts', 'types.ts']);
  for (const name of ['state', 'ui', 'transport', 'streaming', 'workflow', 'history', 'onboarding']) {
    assert.ok((await files(path.join(root, name))).length > 0, name);
  }
  const entry = await readFile(path.join(root, 'index.ts'), 'utf8');
  assert.match(entry, /export \{ ChatProvider \} from "\.\/state\/ChatProvider"/u);
  assert.match(entry, /export \{ StreamingText \} from "\.\/streaming\/StreamingText"/u);
});

test('테스트·fixture는 src 밖에 두고 옛 공통 폴더 import는 되살리지 않는다', async () => {
  for (const file of await files(path.join(projectRoot, 'src'))) {
    assert.doesNotMatch(file, /\.test\.|Fixtures\.(?:mjs|ts)$/u);
    if (!/\.(?:ts|tsx|mjs|js)$/u.test(file)) continue;
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /(?:from\s*|import\s*\()['"]@\/(?:data|context|components\/about|components\/research)\//u, file);
  }
});

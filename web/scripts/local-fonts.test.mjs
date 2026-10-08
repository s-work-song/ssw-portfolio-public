import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const webRoot = new URL('../', import.meta.url);
const fontRoot = new URL('src/assets/fonts/', webRoot);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile(new URL('manifest.json', fontRoot), 'utf8'));

test('Google 폰트는 빌드와 화면에서 외부 조회 대신 로컬 CSS를 사용한다', async () => {
  assert.deepEqual(manifest.fonts.map((font) => font.family), ['Noto Sans KR', 'JetBrains Mono']);
  const layout = await readFile(new URL('src/app/layout.tsx', webRoot), 'utf8');
  const globals = await readFile(new URL('src/app/globals.css', webRoot), 'utf8');
  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.doesNotMatch(globals, /fonts\.(googleapis|gstatic)\.com/);
  assert.match(globals, /@import '\.\.\/assets\/fonts\/noto-sans-kr\.css'/);
  assert.match(globals, /@import '\.\.\/assets\/fonts\/jetbrains-mono\.css'/);
  assert.match(globals, /--font-noto-sans-kr: 'Noto Sans KR'/);
});

for (const font of manifest.fonts) {
  test(`${font.family}: 로컬 subset, 굵기, 해시와 배포 라이선스를 보존한다`, async () => {
    const css = await readFile(new URL(font.stylesheet, fontRoot), 'utf8');
    assert.equal(sha256(css), font.stylesheetSha256);
    assert.doesNotMatch(css, /https?:\/\//);
    assert.match(css, /unicode-range:/);
    assert.match(css, /font-display: swap/);
    assert.match(css, font.family === 'Noto Sans KR' ? /font-weight: 100 900/ : /font-weight: 400 700/);
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((match) => match[1]);
    assert.equal(new Set(urls).size, font.files.length);
    await Promise.all(font.files.map(async (file) => {
      assert.ok(urls.includes(`./${file.path}`));
      const bytes = await readFile(new URL(file.path, fontRoot));
      assert.equal(bytes.subarray(0, 4).toString('ascii'), 'wOF2');
      assert.equal(bytes.length, file.bytes);
      assert.equal(sha256(bytes), file.sha256);
    }));
    const license = await readFile(new URL(font.licensePath, webRoot));
    assert.equal(sha256(license), font.licenseSha256);
    assert.match(license.toString('utf8'), /SIL OPEN FONT LICENSE Version 1\.1/);
  });
}

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { mediaDialogOutsideCloseAllowed } from './mediaDialogPolicy.ts';

test('핀치와 드래그 후 250ms 경계에서 우발적인 바깥 클릭만 차단한다', () => {
  assert.equal(mediaDialogOutsideCloseAllowed(false, null, 100), true);
  assert.equal(mediaDialogOutsideCloseAllowed(true, null, 100), false);
  assert.equal(mediaDialogOutsideCloseAllowed(true, 0, 1000), false);
  assert.equal(mediaDialogOutsideCloseAllowed(false, 100, 349.99), false);
  assert.equal(mediaDialogOutsideCloseAllowed(false, 100, 350), true);
  assert.equal(mediaDialogOutsideCloseAllowed(false, 100, 1000), true);
});

test('공유 래퍼는 controlled Radix modal/Portal과 초기·복귀 포커스만 담당한다', async () => {
  const source = await readFile(new URL('./MediaDialog.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \* as Dialog from '@radix-ui\/react-dialog'/);
  assert.match(source, /<Dialog\.Root open=\{open\} onOpenChange=\{onOpenChange\}/);
  for (const part of ['Portal', 'Overlay', 'Content', 'Title']) {
    assert.ok(source.includes(`<Dialog.${part}`));
  }
  assert.match(source, /onOpenAutoFocus=/);
  assert.match(source, /onCloseAutoFocus=/);
  assert.match(source, /returnFocus\?\.\(\)\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /canCloseFromOutside && !canCloseFromOutside\(\).*event\.preventDefault\(\)/);
  assert.match(source, /role="dialog" aria-modal="true"/);
  assert.doesNotMatch(source, /forceMount|document\.body|addEventListener|window\./);
});

test('게임·이미지 팝업은 공통 래퍼를 쓰고 기존 전역 Escape·body lock을 중복하지 않는다', async () => {
  for (const file of ['ArchiveProjectShowcase.tsx', 'ProjectMediaCarousel.tsx']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /import MediaDialog from '.\/MediaDialog'/);
    assert.match(source, /<MediaDialog/);
    assert.match(source, /initialFocusRef=/);
    assert.match(source, /returnFocus=/);
    assert.match(source, /aria-haspopup="dialog"/);
    assert.doesNotMatch(source, /document\.body|addEventListener\('keydown'|bodyLocked/);
  }
  const image = await readFile(new URL('./ProjectMediaCarousel.tsx', import.meta.url), 'utf8');
  assert.match(image, /canCloseFromOutside=\{\(\) => mediaDialogOutsideCloseAllowed/);
  assert.match(image, /resetGesture\(\);\s*isExpandedRef\.current = false/);
  assert.match(image, /initialSlide=\{activeIndex\}/);
});

test('게임 iframe의 격리·경로·닫기 계약은 라이브러리 전환과 별개로 보존한다', async () => {
  const source = await readFile(new URL('./ArchiveProjectShowcase.tsx', import.meta.url), 'utf8');
  assert.match(source, /sandbox="allow-scripts allow-modals"/);
  assert.match(source, /referrerPolicy="no-referrer"/);
  assert.match(source, /src=\{`\$\{basePath\}\$\{activeProject\.demo\.src\}`\}/);
  assert.match(source, /key=\{activeProject\.id\}/);
  assert.match(source, /aria-label="게임 닫기"/);
  assert.doesNotMatch(source, /allow-same-origin|allow-popups/);
});

test('Dialog 버전·lockfile·공개 라이선스 고지를 함께 유지한다', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8'));
  const lock = JSON.parse(await readFile(new URL('../../../../package-lock.json', import.meta.url), 'utf8'));
  assert.equal(manifest.dependencies['@radix-ui/react-dialog'], '1.1.23');
  assert.equal(lock.packages.web.dependencies['@radix-ui/react-dialog'], '1.1.23');
  assert.equal(lock.packages['node_modules/@radix-ui/react-dialog'].version, '1.1.23');
  const notices = await readFile(new URL('../../../public/licenses/radix-dialog-LICENSES.txt', import.meta.url), 'utf8');
  assert.match(notices, /@radix-ui\/react-dialog@1\.1\.23/);
  assert.match(notices, /Copyright \(c\) 2022 WorkOS/);
  assert.match(notices, /react-remove-scroll@2\.7\.2/);
  assert.match(notices, /aria-hidden@1\.2\.6/);
});

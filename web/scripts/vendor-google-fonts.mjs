import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 폰트를 갱신할 때만 수동으로 실행한다. dev/build/install에서는 실행하지 않는다.
if (!process.argv.includes('--refresh')) {
  throw new Error('폰트 갱신이 필요할 때만 node scripts/vendor-google-fonts.mjs --refresh 를 실행하세요.');
}

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fontRoot = path.join(webRoot, 'src/assets/fonts');
const licenseRoot = path.join(webRoot, 'public/fonts/licenses');
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const fonts = [
  { id: 'noto-sans-kr', family: 'Noto Sans KR', query: 'Noto+Sans+KR:wght@100..900', licenseDirectory: 'notosanskr' },
  { id: 'jetbrains-mono', family: 'JetBrains Mono', query: 'JetBrains+Mono:wght@400..700', licenseDirectory: 'jetbrainsmono' },
];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function download(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !['fonts.googleapis.com', 'fonts.gstatic.com', 'raw.githubusercontent.com'].includes(parsed.hostname)) {
    throw new Error(`Unexpected font source: ${url}`);
  }
  const response = await fetch(url, {
    headers: { 'User-Agent': userAgent },
    signal: AbortSignal.timeout(45_000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`Font download failed: ${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

const manifest = { downloadedAt: new Date().toISOString(), fonts: [] };
for (const font of fonts) {
  const cssSource = `https://fonts.googleapis.com/css2?family=${font.query}&display=swap`;
  const licenseSource = `https://raw.githubusercontent.com/google/fonts/main/ofl/${font.licenseDirectory}/OFL.txt`;
  const css = (await download(cssSource)).toString('utf8');
  const license = await download(licenseSource);
  if (!license.toString('utf8').includes('SIL OPEN FONT LICENSE')) throw new Error('Missing font license');
  const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g)].map((match) => match[1]))];
  if (!urls.length) throw new Error(`No WOFF2 subsets found for ${font.family}`);
  const files = [];
  // 서버에 과도한 동시 요청을 보내지 않도록 여섯 개씩 내려받는다.
  for (let start = 0; start < urls.length; start += 6) {
    files.push(...await Promise.all(urls.slice(start, start + 6).map(async (source, offset) => {
      const bytes = await download(source);
      if (bytes.subarray(0, 4).toString('ascii') !== 'wOF2') throw new Error(`Invalid WOFF2: ${source}`);
      return { path: `${font.id}/${String(start + offset).padStart(3, '0')}.woff2`, source, bytes };
    })));
  }
  let localCss = css;
  for (const file of files) localCss = localCss.replaceAll(file.source, `./${file.path}`);
  if (/https?:\/\//.test(localCss)) throw new Error(`Unconverted font URL in ${font.family}`);
  localCss = `/* Vendored Google Fonts subsets; see README.md and public/fonts/licenses/${font.id}-OFL.txt. */\n${localCss}`;

  await mkdir(path.join(fontRoot, font.id), { recursive: true });
  await mkdir(licenseRoot, { recursive: true });
  for (const file of files) await writeFile(path.join(fontRoot, file.path), file.bytes);
  // 다운로드한 CSS의 URL만 로컬 상대 경로로 일괄 치환한다. 글자 범위와 굵기는 유지한다.
  await writeFile(path.join(fontRoot, `${font.id}.css`), localCss);
  await writeFile(path.join(licenseRoot, `${font.id}-OFL.txt`), license);
  manifest.fonts.push({
    family: font.family,
    cssSource,
    stylesheet: `${font.id}.css`,
    stylesheetSha256: sha256(localCss),
    licenseSource,
    licensePath: `public/fonts/licenses/${font.id}-OFL.txt`,
    licenseSha256: sha256(license),
    files: files.map(({ bytes, ...file }) => ({ ...file, bytes: bytes.length, sha256: sha256(bytes) })),
  });
  console.log(`${font.family}: ${files.length} WOFF2 files, ${files.reduce((sum, file) => sum + file.bytes.length, 0)} bytes`);
}
await writeFile(path.join(fontRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

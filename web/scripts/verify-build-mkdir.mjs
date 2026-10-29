import { mkdir, mkdtemp, realpath, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { MultiFileWriter } = require('next/dist/lib/multi-file-writer');
const { createBuildMkdir } = require('./windows-build-mkdir.cjs');
const webRoot = fileURLToPath(new URL('../', import.meta.url));
const diagnostics = join(webRoot, '.diagnostics');
await mkdir(diagnostics, { recursive: true });
const directory = await mkdtemp(join(diagnostics, 'next-mkdir-'));

async function verify(compatible) {
  const errors = []; let recovered = 0; let retries = 0;
  const makeDirectory = compatible ? createBuildMkdir({
    mkdir, stat, realpath, platform: process.platform, outputRoots: [directory],
    delay: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
    onRecovered: () => { recovered++; }, onRetry: () => { retries++; },
  }) : mkdir;
  for (let index = 0; index < 100; index++) {
    const page = join(directory, `${compatible ? 'compatible' : 'original'}-${index}.segments`);
    const pending = [];
    const writer = new MultiFileWriter({ mkdir: directory => makeDirectory(directory, { recursive: true }),
      writeFile: (...args) => { const result = writeFile(...args); pending.push(result); return result; } });
    for (const segment of ['/about-me/log/slug/page.segment.rsc', '/about-me/log/slug.segment.rsc',
      '/about-me/log.segment.rsc', '/about-me.segment.rsc', '/_tree.segment.rsc']) writer.append(page + segment, 'fixture');
    try { await writer.wait(); } catch (error) { errors.push({ code: error.code, syscall: error.syscall }); }
    await Promise.allSettled(pending);
  }
  const errorCodes = errors.reduce((counts, error) => ({ ...counts, [error.code]: (counts[error.code] ?? 0) + 1 }), {});
  return { cases: 100, failures: errors.length, errorCodes, retries, recovered };
}

const original = await verify(false);
const compatible = await verify(true);
console.log(JSON.stringify({ platform: process.platform, fixture: directory, original, compatible }, null, 2));
if (compatible.failures) process.exitCode = 1;

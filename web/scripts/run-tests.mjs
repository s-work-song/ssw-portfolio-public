import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
async function discover(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await discover(file));
    else if (/\.test\.mjs$/u.test(entry.name)) files.push(file);
  }
  return files.sort();
}

const files = await discover(path.join(projectRoot, 'tests'));
if (files.length === 0) throw new Error('No frontend tests discovered');
console.log(`[tests] frontend/all: ${files.length} files; mock/offline only`);
const child = spawn(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--test',
  ...process.argv.slice(2), ...files], { cwd: projectRoot, stdio: 'inherit', windowsHide: true });
child.once('error', error => { console.error(error); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });

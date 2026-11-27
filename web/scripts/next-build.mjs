import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const nextRequire = createRequire(import.meta.url);
const webRoot = fileURLToPath(new URL('../', import.meta.url));
const nextCli = nextRequire.resolve('next/dist/bin/next');
let environment = process.env;
if (process.platform === 'win32') {
  const preload = fileURLToPath(new URL('./windows-build-mkdir.cjs', import.meta.url)).replaceAll('\\', '/');
  // Preserve the caller's Node options; child build/export workers inherit this.
  const nodeOptions = [process.env.NODE_OPTIONS, `--require=${JSON.stringify(preload)}`].filter(Boolean).join(' ');
  environment = { ...process.env, NODE_OPTIONS: nodeOptions, SSW_NEXT_BUILD_FS_COMPAT: '1' };
}
const child = spawn(process.execPath, [nextCli, 'build', ...process.argv.slice(2)], {
  cwd: webRoot, env: environment, stdio: 'inherit', windowsHide: true,
});
child.once('error', () => { process.stderr.write('Could not start the Next build process.\n'); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });

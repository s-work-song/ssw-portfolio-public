'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- Node --require 프리로드는 CommonJS로 유지한다. */

const path = require('node:path');

function within(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

/**
 * Windows can return EPERM when concurrent recursive mkdir calls create the same
 * ancestor. Retry only after an affected ancestor is a real output directory.
 * No writes, errors, non-recursive calls, or paths outside the build are relaxed.
 */
function createBuildMkdir({ mkdir, stat, realpath, platform, outputRoots, delay,
  maxRetries = 3, onRetry = () => {}, onRecovered = () => {} }) {
  const allowed = target => typeof target === 'string' && outputRoots.some(root => within(root, path.resolve(target)));
  return async function buildMkdir(target, options) {
    let retries = 0;
    for (;;) {
      try {
        const result = await mkdir(target, options);
        if (retries) onRecovered();
        return result;
      } catch (error) {
        if (platform !== 'win32' || options?.recursive !== true || error?.code !== 'EPERM'
          || error.syscall !== 'mkdir' || !allowed(target) || !allowed(error.path)
          || !within(path.resolve(error.path), path.resolve(target)) || retries >= maxRetries) throw error;
        await delay([10, 25, 50][retries] ?? 50);
        try {
          // Windows can report the not-yet-created leaf rather than the shared
          // parent. Walk only inside the allowed output to confirm that parent.
          let ancestor = path.resolve(error.path);
          let confirmed = false;
          while (allowed(ancestor)) {
            try {
              confirmed = (await stat(ancestor)).isDirectory() && allowed(await realpath(ancestor));
              break;
            } catch (inspectionError) {
              if (inspectionError?.code !== 'ENOENT') throw error;
              ancestor = path.dirname(ancestor);
            }
          }
          if (!confirmed) throw error;
        } catch { throw error; }
        retries++;
        onRetry();
      }
    }
  };
}

function installBuildMkdir() {
  if (process.platform !== 'win32' || process.env.SSW_NEXT_BUILD_FS_COMPAT !== '1') return;
  const fs = require('node:fs');
  const promises = require('node:fs/promises');
  const webRoot = fs.realpathSync(path.resolve(__dirname, '..'));
  const outputRoots = [path.join(webRoot, '.next'), path.join(webRoot, 'out')];
  const custom = process.env.SSW_NEXT_DIST_DIR;
  if (custom && custom.length <= 128 && /^(?:\.diagnostics\/next-|\.next-)[A-Za-z0-9_-]+$/u.test(custom)) {
    outputRoots.push(path.join(webRoot, custom));
  }
  let recovered = 0;
  promises.mkdir = createBuildMkdir({
    mkdir: promises.mkdir.bind(promises), stat: promises.stat.bind(promises), realpath: promises.realpath.bind(promises),
    platform: process.platform, outputRoots,
    delay: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
    onRecovered: () => { recovered++; },
  });
  process.once('exit', () => {
    if (recovered) process.stderr.write(`[build:fs] Recovered ${recovered} concurrent recursive-mkdir race(s).\n`);
  });
}

module.exports = { createBuildMkdir, installBuildMkdir };
installBuildMkdir();

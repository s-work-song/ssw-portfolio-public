import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageFile = require.resolve('@mermaid-js/tiny/package.json');
const { version } = JSON.parse(await readFile(packageFile, 'utf8'));
const vendorDirectory = new URL('../public/vendor/mermaid/', import.meta.url);
await mkdir(vendorDirectory, { recursive: true });

// Tiny is a browser IIFE, not an ESM import. Serve the pinned, unchanged bundle
// from our own origin so a visitor does not need to contact a third-party CDN.
await copyFile(require.resolve('@mermaid-js/tiny'), new URL(`mermaid.tiny-${version}.js`, vendorDirectory));
console.log(`Prepared Mermaid Tiny ${version} for static hosting.`);

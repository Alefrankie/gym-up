// Generates .swcrc. SWC needs an absolute `baseUrl` for `paths`, so the file is written per machine
// (it is git-ignored). SWC is used instead of Wrangler's esbuild because esbuild does not emit
// decorator metadata (ADR-027 spike).

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const baseUrl = resolve('src').split('\\').join('/');
const config = {
  jsc: {
    target: 'es2022',
    parser: { syntax: 'typescript', decorators: true },
    transform: { legacyDecorator: true, decoratorMetadata: true },
    keepClassNames: true,
    baseUrl,
    // `@db/*` is intentionally absent: it is resolved by the bundler (wrangler.jsonc "alias").
    paths: { '@/*': ['./*'] },
  },
  module: { type: 'es6' },
  sourceMaps: false,
};
writeFileSync('.swcrc', JSON.stringify(config, null, 2));

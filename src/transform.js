export * from '../dist/preset-jest.js';
import { js as defaultJs } from '../dist/preset-jest.js';

/** @type {Record<string, string>} */
const parts = {};

/** @type {import('./markdown-to-test').Transformer} */
export const js = {
  ...defaultJs,
  transform(content, opts) {
    if (opts.context?.id) {
      parts[opts.context.id] = content;
      if (opts.context.id === 'output') {
        return buildReadmeTest(opts);
      }
      return null;
    }

    return defaultJs.transform(content, opts);
  },
};

/** @type {import('./markdown-to-test').Transformer} */
export const ts = {
  transform: js.transform,
};

/** @type {import('./markdown-to-test').Transformer} */
export const unknown = {
  transform(content, { context }) {
    if (context?.id) {
      parts[context.id] = content;
    }

    return null;
  },
};

/**
 * @param {{ file: string, basePath: string, index: number }} opts
 * @returns {Promise<import('./markdown-to-test').DetailedTestTransformResult | null>}
 */
async function buildReadmeTest(opts) {
  const test = `
import { fs, vol } from 'memfs';
const fakeFS = fs.promises;
vol.fromJSON({
  './Readme.md': \`${parts.source}\`
}, '/app');

${parts.transformer}

${parts.exec
  .replace('markdown-to-test', './dist/markdown-to-test.js')
  .replace(
    "import transform from './myTransformers.ts';",
    'const transform = { js };',
  )
  .replace(/process\.cwd\(\)/g, '"/app"')
  .replace('// ...', 'fs: fakeFS')}

expect((await fakeFS.readFile('/app/Readme.js')).toString()).toBe(\`${
    parts.output
  }\`);
  `;

  return defaultJs.transform(test, {
    ...opts,
    context: { title: 'combined readme examples' },
  });
}

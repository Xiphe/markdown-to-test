import type { Transformer, TransformFn } from './markdown-to-test';
import indent from 'indent-string';
import path from 'node:path';
import fs from 'node:fs/promises';
import { findUp } from 'find-up';
import { transform } from 'esbuild';

const pkgPath = process.env.npm_package_json;

const transformExample: TransformFn = async (
  content,
  { file, basePath, index, context = {} },
) => {
  if (context.ignore) {
    return null;
  }
  const sourcefile = path.join(basePath, file);
  const tsconfigPath = await findUp('tsconfig.json', {
    cwd: path.dirname(sourcefile),
    stopAt: pkgPath ? path.dirname(pkgPath) : undefined,
  });
  const tsconfigRaw = tsconfigPath
    ? JSON.parse((await fs.readFile(tsconfigPath)).toString())
    : {};

  const result = await transform(
    `${context.before || ''}${content}${context.after || ''}`,
    {
      tsconfigRaw,
      sourcefile,
      loader: 'tsx',
      format: 'cjs',
      target: 'node16',
      platform: 'node',
    },
  );

  const title = (context.title || `example nr. ${index + 1} works`).replace(
    /\'/g,
    "\\'",
  );
  const body = indent(result.code.trim(), 2);

  const wrapped =
    context.expect === 'error'
      ? indent(
          `await expect(async () => {\n${body}\n}).rejects.toMatchSnapshot()`,
          2,
        )
      : body;

  return {
    content: `it('${title}', async () => {\n${wrapped}\n})`,
    lang: 'js',
  };
};

export const js: Transformer = {
  transform: transformExample,
  wrap(content, file) {
    return `// @ts-nocheck\ndescribe('Examples in ${file}', () => {\n${indent(
      content,
      2,
    )}\n});`;
  },
  rename(file) {
    return file.replace(/(\.md|\.markdown)$/i, '.test.js');
  },
};
export const cjs: Transformer = {
  transform: transformExample,
};
export const mjs: Transformer = {
  transform: transformExample,
};
export const jsx: Transformer = {
  transform: transformExample,
};
export const tsx: Transformer = {
  transform: transformExample,
};
export const ts: Transformer = {
  transform: transformExample,
};

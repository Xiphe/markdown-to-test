import type {
  DetailedTestTransformResult,
  Transformer,
  TransformFn,
} from './markdown-to-test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { findUp } from 'find-up';
import { transform, TransformOptions } from 'esbuild';

interface Context {
  imports: string[];
}
const pkgPath = process.env.npm_package_json;

function createTransformExample(
  lang: string,
): TransformFn<DetailedTestTransformResult<Context> | null> {
  return async (content, { index, context = {} }) => {
    if (context.ignore) {
      return null;
    }

    const testBody = `${context.before || ''}\n${content}\n${
      context.after || ''
    }`;
    const importStatements = testBody.match(/(^|\n)import.+/gm) || [];
    const contentWoImport = importStatements.reduce(
      (mem, statement) => mem.replace(statement, ''),
      testBody,
    );
    const contentWoExport = contentWoImport
      .replace(/(^|\n)export /g, '\n')
      .replace(/(^|\n)export default/g, '\nconst defaultExport =');

    const wrapped =
      context.expect === 'error'
        ? `await expect(async () => {\n${contentWoExport}\n}).rejects.toMatchSnapshot()`
        : contentWoExport;

    const title = (context.title || `example nr. ${index + 1} works`).replace(
      /\'/g,
      "\\'",
    );

    return {
      content: `test('${title}', async () => {\n${wrapped}\n})`,
      context: {
        imports: importStatements,
      },
      lang,
    };
  };
}

function createWrap(
  transformOptions?: TransformOptions,
): Required<Transformer<Context>>['wrap'] {
  return async (contents, { basePath, file }) => {
    const sourcefile = path.join(basePath, file);
    const tsconfigPath = await findUp('tsconfig.json', {
      cwd: path.dirname(sourcefile),
      stopAt: pkgPath ? path.dirname(pkgPath) : undefined,
    });
    const tsconfigRaw = tsconfigPath
      ? JSON.parse((await fs.readFile(tsconfigPath)).toString())
      : {};

    const imports: string[] = [];
    const body: string[] = [];

    for (const { content, context } of contents) {
      body.push(content);
      imports.push(...(context?.imports || []));
    }

    const content = `${imports.join(
      '\n',
    )}\ndescribe('Examples in ${file}', () => {\n${body.join('\n')}\n});`;

    const result = await transform(content, {
      tsconfigRaw,
      sourcefile,
      loader: 'tsx',
      format: 'esm',
      target: 'es2020',
      platform: 'node',
      ...transformOptions,
    });

    return `// @ts-nocheck\n${result.code}`;
  };
}

export const js: Required<
  Transformer<Context, DetailedTestTransformResult<Context> | null>
> = {
  transform: createTransformExample('js'),
  wrap: createWrap(),
  rename(file) {
    return file.replace(/(\.md|\.markdown)$/i, '.test.js');
  },
};
export const cjs: Transformer = {
  transform: createTransformExample('cjs'),
  wrap: createWrap({ format: 'cjs' }),
  rename(file) {
    return file.replace(/(\.md|\.markdown)$/i, '.test.cjs');
  },
};
export const mjs: Transformer = {
  transform: createTransformExample('js'),
};
export const jsx: Transformer = {
  transform: createTransformExample('js'),
};
export const tsx: Transformer = {
  transform: createTransformExample('js'),
};
export const ts: Transformer = {
  transform: createTransformExample('js'),
};

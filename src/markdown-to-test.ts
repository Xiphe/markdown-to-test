import { wtch, cmpl, WtchOpts, Prcssr, WatchFs } from 'cmpl';
import ignore, { Ignore } from 'ignore';
import { parse as parseYaml } from 'yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Content } from 'mdast';

export type TestTransformResult =
  | null
  | string
  | Buffer
  | {
      content: Buffer | string;
      lang: string;
    };
export type TransformFn = (
  content: string,
  opts: {
    context: any;
    file: string;
    basePath: string;
    index: number;
  },
) => TestTransformResult | Promise<TestTransformResult>;
export interface Transformer {
  transform?: TransformFn;
  rename?: (file: string, content: Buffer) => string;
  wrap?: (
    content: string,
    file: string,
  ) => null | Buffer | string | Promise<null | Buffer | string>;
}
export interface Options
  extends Pick<WtchOpts, 'entry' | 'fs' | 'path'>,
    Omit<ProcessorOptions, 'ignore' | 'basePath'> {
  ignoreFile?: string;
  watch?: boolean;
}

export default function markdownToTest(
  options: Omit<Options, 'watch'> & { watch: true },
): ReturnType<typeof wtch>;
export default function markdownToTest(
  options: Omit<Options, 'watch'> & { watch?: never | false },
): ReturnType<typeof cmpl>;
export default function markdownToTest(
  options: Omit<Options, 'watch'> & { watch: boolean },
): ReturnType<typeof cmpl> | ReturnType<typeof wtch>;
export default function markdownToTest({
  entry,
  fs = import('node:fs/promises'),
  path = import('node:path'),
  ignoreFile,
  watch,
  ...rest
}: Options) {
  const basePath = Promise.all([fs, path]).then(async ([fs, path]) =>
    (await fs.stat(entry)).isDirectory() ? entry : path.dirname(entry),
  );

  const options: WtchOpts = {
    entry,
    fs,
    path,
    processors: [
      createMarkdownToTestProcessor({
        ignore: Promise.resolve(fs).then((fs) => getIgnores(fs, ignoreFile)),
        basePath,
        ...rest,
      }),
    ],
  };

  if (watch) {
    return wtch(options);
  }

  return cmpl(options);
}

interface ProcessorOptions extends Pick<Prcssr, 'recursive' | 'outDir'> {
  basePath: string | Promise<string>;
  ignoreUnknown?: boolean;
  ignoreFile?: string;
  ignore?: Ignore | Promise<Ignore | undefined>;
  transform: Record<string, Transformer>;
}
export async function createMarkdownToTestProcessor({
  recursive,
  outDir,
  basePath,
  transform,
  ignore,
  ignoreUnknown = false,
}: ProcessorOptions): Promise<Prcssr> {
  const ig = await ignore;

  return {
    recursive,
    include: (name, isDir) => {
      if (ig && ig.ignores(name)) {
        return false;
      }
      return isDir || Boolean(name.match(/(\.md|\.markdown)$/i));
    },
    outDir,
    async transform(content, file) {
      const { children } = unified().use(remarkParse).parse(content);
      const tests: Record<string, (string | Buffer | null)[]> = {};
      let i = 0;
      let previous: Content | null = null;

      for (const content of children) {
        const prev = previous;
        previous = content;
        if (content.type !== 'code') {
          continue;
        }

        const transformer = transform[content.lang || 'unknown']?.transform;
        if (!transformer) {
          if (!ignoreUnknown) {
            throw new Error(`No transformer for language ${content.lang}`);
          }
          continue;
        }

        const context =
          prev?.type === 'html' ? parseContext(prev.value) : undefined;

        const test = await transformer(content.value, {
          file,
          basePath: await basePath,
          index: i++,
          context,
        });

        if (!test) {
          continue;
        }
        const lang =
          typeof test === 'string' || test instanceof Buffer
            ? content.lang || 'unknown'
            : test.lang;
        const testContent =
          typeof test === 'string' || test instanceof Buffer
            ? test
            : test.content;

        if (!tests[lang]) {
          tests[lang] = [];
        }
        tests[lang].push(testContent);
      }

      return Promise.all(
        Object.entries(tests).map(async ([lang, tests]) => {
          const {
            wrap = (c: string) => c,
            rename = (f: string) =>
              f.replace(/(\.md|\.markdown)$/i, `.${lang}`),
          } = transform[lang || 'unknown'] || {};

          const resp = await wrap(
            tests
              .filter(
                (t: string | Buffer | null): t is Buffer | string => t !== null,
              )
              .map((t) => t.toString())
              .join('\n\n'),
            file,
          );

          if (!resp) {
            return null;
          }

          const buf = typeof resp === 'string' ? Buffer.from(resp) : resp;

          return { name: rename(file, buf), content: buf };
        }),
      ).then((r) =>
        r.filter(
          (
            entry,
          ): entry is {
            content: Buffer;
            name: string;
          } => entry !== null,
        ),
      );
    },
  };
}

async function getIgnores(fs: WatchFs, ignoreFile?: string) {
  if (!ignoreFile) {
    return;
  }

  return ignore()
    .add('.git')
    .add((await fs.readFile(ignoreFile)).toString());
}

function parseContext(comment: string): any {
  try {
    return parseYaml(comment.replace(/^<!--|-->$/g, ''));
  } catch {
    return undefined;
  }
}

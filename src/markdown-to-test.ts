import { wtch, cmpl, WtchOpts, Prcssr, WatchFs } from 'cmpl';
import ignore from 'ignore';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Content } from 'mdast';

export type TransformFn = (
  content: string,
  context: {
    file: string;
    wrap: boolean;
    index: number | false;
    context: any;
  },
) => Buffer | string | null | Promise<Buffer | string | null>;

export interface Options
  extends Pick<WtchOpts, 'entry' | 'fs' | 'path'>,
    Omit<ProcessorOptions, 'fs'> {
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
  path,
  watch,
  ...rest
}: Options) {
  const options: WtchOpts = {
    entry,
    fs,
    path,
    processors: [
      createMarkdownToTestProcessor({
        fs,
        ...rest,
      }),
    ],
  };

  if (watch) {
    return wtch(options);
  }

  return cmpl(options);
}

interface ProcessorOptions
  extends Pick<Prcssr, 'recursive' | 'outDir' | 'rename'> {
  ignoreUnknown?: boolean;
  ignoreFile?: string;
  fs: WatchFs | Promise<WatchFs>;
  transform: Record<string, TransformFn>;
}
export async function createMarkdownToTestProcessor({
  recursive,
  outDir,
  fs,
  rename,
  transform,
  ignoreFile,
  ignoreUnknown = false,
}: ProcessorOptions): Promise<Prcssr> {
  const ig = await getIgnores(await fs, ignoreFile);

  return {
    recursive,
    rename,
    include: (name, isDir) => {
      if (ig && ig.ignores(name)) {
        return false;
      }
      return isDir || Boolean(name.match(/(\.md|\.markdown)$/i));
    },
    outDir,
    async transform(content, file) {
      const { children } = unified().use(remarkParse).parse(content);
      const tests: (string | Buffer | null)[] = [];
      let i = 0;
      let previous: Content | null = null;

      for (const content of children) {
        const prev = previous;
        previous = content;
        if (content.type !== 'code') {
          continue;
        }

        const transformer = transform[content.lang || 'unknown'];
        if (!transformer) {
          if (!ignoreUnknown) {
            throw new Error(`No transformer for language ${content.lang}`);
          }
          continue;
        }

        const context =
          prev?.type === 'html' ? parseContext(prev.value) : undefined;
        tests.push(
          await transformer(content.value, {
            file,
            wrap: false,
            index: i++,
            context,
          }),
        );
      }

      const wrapper = transform.wrap || ((c: string) => c);
      const resp = await wrapper(
        tests
          .filter(
            (t: string | Buffer | null): t is Buffer | string => t !== null,
          )
          .map((t) => t.toString())
          .join('\n\n'),
        { file, wrap: true, index: false, context: null },
      );

      if (typeof resp === 'string') {
        return Buffer.from(resp);
      }
      return resp;
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
    return JSON.parse(comment.replace(/^<!--|-->$/g, ''));
  } catch {
    return undefined;
  }
}

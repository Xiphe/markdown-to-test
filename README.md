# markdown-to-test

extract code examples from markdown to test files

## Install

<!-- ignore: true -->

```bash
npm install markdown-to-test
# yarn add markdown-to-test
```

## CLI

<!-- ignore: true -->

```bash
npx markdown-to-test -h
```

<!-- ignore: true -->

```
Usage:
  markdown-to-test [options] [entry]

Entry:
  single markdown file or directory containing them
  (default: cwd)

Options:
  --transform         -t        comma separated list of transformers
                                can be either name of build in, path or module name
                                (default: jest)
  --watch             -w        watch for changes
                                (default: false)
  --recursive         -r        look for markdown files in sub-directories
                                (default: true)
  --out-dir           -o        directory where test files should be placed
                                (default: cwd)
  --ignore-file       -i        gitignore style file containing paths to ignore
                                (default: .gitignore)
  --help              -h        display this message
  --version           -v        display version
```

## Lib

<!-- id: exec -->

```ts
import markdownToTest, { Options } from 'markdown-to-test';
import transform from './myTransformers.ts';

const options: Options = {
  transform,
  entry: process.cwd(),
  outDir: process.cwd(),
  watch: false,
  // ignoreFile,
  // recursive,
  // ...
};

await markdownToTest(options);
```

## Transformers

Given this markdown code-block in `Readme.md`:

<!-- id: source -->

```
<!--
custom: add custom context here
-->
\`\`\`js
const hello = 'Hello';
\`\`\`
```

And this transformer `myTransformers.ts`:

<!-- id: transformer -->

```ts
/** @type {import('markdown-to-test').Transformer} */
export const js = {
  transform(content, { index, context }) {
    return `
      test('Example Nr ${index + 1} works', () => {
        ${content}
        console.log(${JSON.stringify(context)});
        expect(hello).toBe('Hello');
      });
    `.replace(/\n    /g, '\n');
  },
  wrap(contents, { file }) {
    const body = contents.map(({ content }) => content).join('\n');
    return `describe('Examples in ${file}', () => {${body}});`;
  },
  rename(file) {
    return file.replace(/(\.md|\.markdown)$/i, '.js');
  },
};
```

Run with:

<!-- ignore: true -->

```bash
markdown-to-test --transform myTransformers.ts Readme.md
```

Creates `Readme.js` file:

<!-- id: output -->

```ts
describe('Examples in Readme.md', () => {
  test('Example Nr 1 works', () => {
    const hello = 'Hello';
    console.log({"custom":"add custom context here"});
    expect(hello).toBe('Hello');
  });
});
```

## Build in Transformers

### `jest` (default)

converts `js`, `cjs`, `mjs`, `jsx`, `ts`, `tsx` code blocks to jest tests.

Supports custom test titles, ignoring blocks and prepending and appending
custom code. See [Example.md](./Example.md) for usage details.

# markdown-to-test

extract code examples from markdown to test files

## Install

```bash
npm install markdown-to-test
# yarn add markdown-to-test
```

## CLI

```bash
npx markdown-to-test -h
```

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

```ts
import markdownToTest, { Options } from 'markdown-to-test';
import transform from './myTransformers.ts';

const options: Options = {
  transform,
  entry: process.cwd(),
  outDir: process.cwd(),
  watch: false,
  // ignoreFile,
  // ignoreFile,
  // recursive,
  // ...
};

await markdownToTest(options);
```

## Transformers

Given this markdown code-block in `Readme.md`:

```
<!--
custom: add custom context here
-->
\`\`\`js
const hello = 'Hello';
\`\`\`
```

And this transformer `myTransformers.ts`:

```ts
/** @type {import('./dist/markdown-to-test').Transformer} */
export const js = {
  transform(content, { index, context }) {
    return `
      test('Example Nr ${index + 1} works', () => {
        ${content}
        console.log(${JSON.stringify(context)});
        expect(hello).toBe('Hello');
      });`;
  },
  wrap(content, file) {
    return `describe('Examples in ${file}', () => {\n${content}\n});`;
  },
  rename(file) {
    return file.replace(/(\.md|\.markdown)$/i, '.js');
  },
};
```

Run with:

```bash
markdown-to-test --transform myTransformers.ts Readme.md
```

Creates `Readme.js` file:

```js
describe('Examples in Test.md', () => {
  test('Example Nr 1 works', () => {
    const hello = 'Hello';
    console.log({ custom: 'add custom context here' });
    expect(hello).toBe('Hello');
  });
});
```

## Build in Transformers

### `jest` (default)

converts `js`, `cjs`, `mjs`, `jsx`, `ts`, `tsx` code blocks to jest tests.

Supports custom test titles, ignoring blocks and prepending and appending
custom code. See [Example.md](./Example.md) for usage details.

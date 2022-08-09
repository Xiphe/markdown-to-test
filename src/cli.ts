#!/usr/bin/env node

import url from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import minimist from 'minimist';
import CodeFrameError from 'code-frame-error';
import markdownToTest, { Options, Transformer } from './markdown-to-test.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

run().catch((err) => {
  console.error(
    err instanceof CodeFrameError ? err.toString({ highlightCode: true }) : err,
  );
  process.exit(1);
});

async function run() {
  const argv = minimist(process.argv.slice(2), {
    alias: {
      h: 'help',
      t: 'transform',
      r: 'recursive',
      o: 'out-dir',
      w: 'watch',
      v: 'version',
      i: 'ignore-file',
      u: 'ignore-unknown',
    },
    boolean: ['help', 'recursive', 'watch', 'version', 'ignore-unknown'],
    default: {
      'ignore-unknown': true,
      recursive: true,
    },
  });

  if (argv.version) {
    console.log(await getVersion());
    return;
  }

  if (argv.help) {
    return displayHelp();
  }

  if (argv._.length > 1) {
    throw new Error('Unexpected multiple entries');
  }

  const entry = argv._.length === 0 ? process.cwd() : argv._[0];
  const ignoreFile = argv['ignore-file'] || '.gitignore';
  const outDir = argv['out-dir'] || process.cwd();
  const watch: boolean = argv.watch;
  const recursive: boolean = argv.recursive;
  const ignoreUnknown: boolean = argv['ignore-unknown'];

  const options: Options = {
    entry,
    outDir,
    ignoreFile,
    recursive,
    ignoreUnknown,
    transform: await getTransforms(argv),
  };

  if (watch === true) {
    for await (const _ of markdownToTest({ ...options, watch: true })) {
      console.log('waiting for changes...');
    }
  } else {
    await markdownToTest({ ...options, watch: false });
  }
}

async function displayHelp() {
  console.log(`
Usage:
  markdown-to-test [options] [entry]

Version:
  ${await getVersion()}

Entry:
  single markdown file or directory containing them
  (default: cwd)

Options:
  --transform         -t  comma separated list of transformers
                          can be either name of build in, path or module name
                          (default: jest)
  --watch             -w  watch for changes
                          (default: false)
  --out-dir           -o  directory where test files should be placed
                          (default: cwd)
  --ignore-file       -i  gitignore style file containing paths to ignore
                          (default: .gitignore)
  --no-recursive          do not search sub-directories for markdown files
  --no-ignore-unknown     throw on code blocks that do not have a
                          transformer
  --help              -h  display this message
  --version           -v  display version
`);
}

async function getVersion() {
  try {
    const pkg = await fs.readFile(path.join(__dirname, '../package.json'));
    return JSON.parse(pkg.toString()).version;
  } catch {
    return 'unknown';
  }
}

async function getTransforms(argv: Record<string, string>) {
  const transformOpt = (argv.transform || 'jest')
    .split(',')
    .map((s) => s.trim())
    .map((s) => (s === 'jest' ? path.resolve(__dirname, 'preset-jest.js') : s));

  const transforms: Record<string, Transformer> = {};

  for (const transformFile of transformOpt) {
    const module = await import(path.resolve(transformFile));
    for (const key in module) {
      if (seemsLikeTransformer(module[key])) {
        transforms[key] = Object.assign(transforms[key] || {}, module[key]);
      }
    }
  }

  return transforms;
}

function seemsLikeTransformer(input: unknown): input is Transformer {
  return (
    typeof input === 'object' &&
    input !== null &&
    !Array.isArray(input) &&
    ['function', 'undefined'].includes(typeof (input as any).transform) &&
    ['function', 'undefined'].includes(typeof (input as any).wrap) &&
    ['function', 'undefined'].includes(typeof (input as any).ext)
  );
}

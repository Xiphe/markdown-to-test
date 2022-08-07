#!/usr/bin/env node

import url from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import minimist from 'minimist';
import markdownToTest, { Options, TransformFn } from './markdown-to-test.js';

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function run() {
  const argv = minimist(process.argv.slice(2), {
    alias: {
      e: 'ext',
      h: 'help',
      t: 'transform',
      o: 'out-dir',
      w: 'watch',
      i: 'ignore-file',
    },
  });

  if (argv.help) {
    return displayHelp();
  }

  if (argv._.length > 1) {
    throw new Error('Unexpected multiple entries');
  }

  const entry = argv._.length === 0 ? process.cwd() : argv._[0];
  const ignoreFile = argv['ignore-file'] || '.gitignore';
  const outDir = argv['out-dir'] || 'markdown-tests';
  const ext = argv.ext || '.test.js';
  const watch: boolean = argv.watch;

  const options: Options = {
    entry,
    outDir,
    ignoreFile,
    transform: await getTransforms(argv),
    rename: (original) => original.replace(/(\.md|\.markdown)$/i, ext),
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
  markdown-to-test [options] [entry points]

Version:
  ${await getVersion()}

Options:
  --transform         -t        path to a transform file providing transformers
                                for all languages used in code blocks
                                (default: markdown-to-test.js)
  --transform-[lang] --t[lang]  path to transform file for given language
  --watch             -w        watch for changes
  --ext               -e        target file extension
                                (default: .test.js)
  --out-dir           -o        directory where test files should be placed
                                (default: markdown-tests)
  --ignore-file       -i        gitignore style file containing paths to ignore
                                (default: .gitignore)
  --help              -h        display this message
`);
}

async function getVersion() {
  try {
    const pkg = await fs.readFile(
      path.join(
        path.dirname(url.fileURLToPath(import.meta.url)),
        '../package.json',
      ),
    );
    return JSON.parse(pkg.toString()).version;
  } catch {
    return 'unknown';
  }
}

async function getTransforms(argv: Record<string, string>) {
  const multiTransforms: Record<string, TransformFn> = {};
  const transforms: Promise<[lang: string, transform: TransformFn]>[] = [];

  const multiTransformFile = path.resolve(
    argv.transform || 'markdown-to-test.js',
  );

  if (
    await fs.access(multiTransformFile).then(
      () => true,
      () => false,
    )
  ) {
    const maybeTransforms = await import(multiTransformFile);
    for (const t in maybeTransforms) {
      if (typeof maybeTransforms[t] !== 'function') {
        console.warn(
          `export ${t} of ${argv.transform} is not a function, ignoring`,
        );
        continue;
      }
      multiTransforms[t] = maybeTransforms[t];
    }
  }

  for (const key in argv) {
    const m = key.match(/^(t|transform-)([a-z0-9A-Z]+)/);
    if (!m || key === 't' || key === 'transform') {
      continue;
    }

    transforms.push(
      new Promise<[lang: string, transform: TransformFn]>(
        async (resolve, reject) => {
          try {
            const lang = m[2];
            let deep: string = 'default';
            const filename = argv[key].replace(/:[^\.]+$/, (d) => {
              deep = d.substring(1);
              return '';
            });

            const module = await import(path.resolve(filename));
            if (!module[deep]) {
              throw new Error(`${filename} has no ${deep} export`);
            }

            if (typeof module[deep] !== 'function') {
              throw new Error(
                `${deep} export of ${filename} is not a function`,
              );
            }

            resolve([lang, module[deep]]);
          } catch (err) {
            reject(err);
          }
        },
      ),
    );
  }

  return {
    ...multiTransforms,
    ...Object.fromEntries(await Promise.all(transforms)),
  };
}

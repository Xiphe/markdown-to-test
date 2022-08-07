import indent from 'indent-string';

/** @type {import('./src/markdown-to-test').Transformer} */
export const js = {
  transform(content, { index, context }) {
    const code =
      context && context.id === 'this-one-fails'
        ? `expect(() => {\n${indent(
            content,
            2,
          )}\n}).toThrowErrorMatchingSnapshot();`
        : content;

    return {
      lang: 'js',
      content: `it('s example nr ${(index || 0) + 1} works', () => {\n${indent(
        code,
        2,
      )}\n});`,
    };
  },
  wrap(content, file) {
    return `describe('markdown-to-test (${file})', () => {\n${indent(
      content,
      2,
    )}\n});`;
  },
  rename(file) {
    return file.replace(/(\.md|\.markdown)$/i, '.test.js');
  },
};

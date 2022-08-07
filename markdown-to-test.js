import indent from 'indent-string';

/** @type {import('./src/markdown-to-test').TransformFn} */
export function js(content, { index, context }) {
  const code =
    context && context.id === 'this-one-fails'
      ? `expect(() => {\n${indent(
          content,
          2,
        )}\n}).toThrowErrorMatchingSnapshot();`
      : content;

  return `it('s example nr ${(index || 0) + 1} works', () => {\n${indent(
    code,
    2,
  )}\n});`;
}

/** @type {import('./src/markdown-to-test').TransformFn} */
export function wrap(content) {
  return `describe('markdown-to-test', () => {\n${indent(content, 2)}\n});`;
}

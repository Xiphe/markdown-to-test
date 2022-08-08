# Test markdown document

this is an example document containing code blocks that should be tested
by markdown-to-test

<!--
title: logs to console
before: jest.spyOn(console, 'log').mockImplementationOnce(() => {});
after: expect(console.log).toHaveBeenCalledTimes(1);
-->

```js
console.log('HI');
```

<!--
title: can be wrapped
before: 'expect(() => {'
after: '}).toThrowErrorMatchingInlineSnapshot(`"FAIL!"`);'
-->

```mjs
throw new Error('FAIL!');
```

<!-- {"ignore": true} -->

```cjs
expect(true).toBe(false);
```

<!--
title: renders react element
before: import { create } from 'react-test-renderer';
after: |
  const element = create(<App />);

  expect(element.toJSON()).toEqual({
    type: 'h1',
    props: {},
    children: ['hello'],
  });
-->

```tsx
import { useState, FC } from 'react';

const App: FC = () => {
  const [t] = useState('hello');

  return <h1>{t}</h1>;
};
```

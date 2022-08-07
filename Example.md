# Test markdown document

this is an example document containing code blocks that should be tested
by markdown-to-test

```js
console.log('HI');
```

<!-- { "id": "this-one-fails" } -->

```js
throw new Error('FAIL!');
```

```js
expect(true).toBe(true);
```

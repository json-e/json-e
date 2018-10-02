Support of `index` or `key` context variable in `$map` operation.

```yaml
template:
  $map: [2, 4, 6]
  each(x,i): {$eval: 'x + a + i'}
context:  {a: 1}
result:   [3, 6, 9]
---
template:
  $map: {a: 1, b: 2, c: 3}
  each(v,k): {'${k}x': {$eval: 'v + 1'}}
context:  {}
result: {ax: 2, bx: 3, cx: 4}
```
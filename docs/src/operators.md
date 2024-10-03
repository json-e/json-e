# Operators

JSON-e defines a bunch of operators. Each is represented as an object with a
property beginning with `$`. This object can be buried deeply within the
template. Some operators take additional arguments as properties of the same
object.

## Truthiness

Many values can be evaluated in context where booleans are required,
not just booleans themselves. JSON-e defines the following values as false.
Anything else will be true.

```yaml,json-e
template: {$if: 'a || b || c || d || e || f', then: "uh oh", else: "falsy" }
context: {a: null, b: [], c: {}, d: "", e: 0, f: false}
result: "falsy"
```

## `$eval`

The `$eval` operator evaluates the given expression and is replaced with the
result of that evaluation. Unlike with string interpolation, the result need
not be a string, but can be an arbitrary data structure.

```yaml,json-e
template: {config: {$eval: 'settings.staging'}}
context:
  settings:
    staging:
      transactionBackend: mock
    production:
      transactionBackend: customerdb
result:
  {config: {transactionBackend: 'mock'}}
```

The expression syntax is described in more detail below.

Note that `$eval`'s value must be a string. "Metaprogramming" by providing a
calculated value to eval is not allowed.  For example, `{$eval: {$eval:
"${var1} + ${var2}"}}` is not valid JSON-e.

## `$json`

The `$json` operator formats the given value as JSON with sorted keys. It does
not evaluate the value (use `$eval` for that). While this can be useful in some
cases, it is an unusual case to include a JSON string in a larger data
structure.

Parsing the result of this operator with any compliant JSON parser will give
the same results. However, the encoding may differ between implementations of
JSON-e. For example, numeric representations or string escapes may differ
between implementations.

```yaml,json-e
template: {$json: [a, b, {$eval: 'a+b'}, 4]}
context:  {a: 1, b: 2}
result:   '["a","b",3,4]'
```

## `$if` - `then` - `else`

The `$if` operator supports conditionals. It evaluates the given value, and
replaces itself with the `then` or `else` properties. If either property is
omitted, then the expression is omitted from the parent object.

```yaml,json-e
template: {key: {$if: 'cond', then: 1}, k2: 3}
context:  {cond: true}
result:   {key: 1, k2: 3}
```

```yaml,json-e
template: {$if: 'x > 5', then: 1, else: -1}
context:  {x: 10}
result:   1
```

```yaml,json-e
template: [1, {$if: 'cond', else: 2}, 3]
context: {cond: false}
result: [1,2,3]
```

```yaml,json-e
template: {key: {$if: 'cond', then: 2}, other: 3}
context: {cond: false}
result: {other: 3}
```

## `$flatten`

The `$flatten` operator flattens an array of arrays into one array.

```yaml,json-e
template: {$flatten: [[1, 2], [3, 4], [5]]}
context:  {}
result:   [1, 2, 3, 4, 5]
```

## `$flattenDeep`

The `$flattenDeep` operator deeply flattens an array of arrays into one array.

```yaml,json-e
template: {$flattenDeep: [[1, [2, [3]]]]}
context:  {}
result:   [1, 2, 3]
```

## `$fromNow`

The `$fromNow` operator is a shorthand for the built-in function `fromNow`. It
creates a JSON (ISO 8601) datestamp for a time relative to the current time
(see the `now` builtin, below) or, if `from` is given, relative to that time.

The offset is specified by a sequence of number/unit pairs in a string.
Whitespace is ignored, but the units must be given in ordre from largest to
smallest. To produce a time in the past, prefix the string with `-`. A `+`
prefix is allowed as a redundant way to specify a time in the future.

```yaml,json-e
template: {$fromNow: '2 days 1 hour'}
context:  {}
result:   '2017-01-21T17:27:20.974Z'
```

```yaml,json-e
template: {$fromNow: '1 hour', from: '2017-01-19T16:27:20.974Z'}
context:  {}
result:   '2017-01-19T17:27:20.974Z'
```

The available units, including useful shorthands, are:

```none
years,    year,   yr,   y
months,   month,  mo
weeks,    week,   wk,   w
days,     day,          d
hours,    hour,   hr,   h
minutes,  minute, min,  m
seconds,  second, sec,  s
```

## `$let`

The `$let` operator evaluates an expression using a context amended with the
given values. It is analogous to the Haskell `where` clause.

```yaml,json-e
template: {$let: {ts: 100, foo: 200},
           in: [{$eval: "ts+foo"}, {$eval: "ts-foo"}, {$eval: "ts*foo"}]}
context: {}
result: [300, -100, 20000]
```

The `$let` operator here added the `ts` and `foo` variables to the scope of
the context and accordingly evaluated the `in` clause using those variables
to return the correct result.

An expression like `{$let: {$eval: "extraVariables"}, in : ..}` is supported. As long as
the value of `$let` evaluates to an object with valid key(s), the *values* of which are
evaluated.

```yaml,json-e
template: {$let: {$if: something == 3, then: {a: 10, b: 10}, else: {a: 20, b: 10}},
          in: {$eval: 'a + b'}}
context:  {'something': 3}
result:   20
```

```yaml,json-e
template: {$let: {"b": {$eval: "a + 10"}},
          in: {$eval: "a + b"}}
context:  {a: 5}
result:   20
```

```yaml,json-e
template: {$let: {"first_${name}": 1, "second_${name}": 2},
          in: {$eval: "first_prize + second_prize"}}
context:  {name: "prize"}
result:   3
```

## `$map`

The `$map` operator evaluates an expression for each value of the given array or object,
constructing the result as an array or object of the evaluated values.

### Over Arrays

When given an array, `$map` always returns an array.

```yaml,json-e
template:
  $map: [2, 4, 6]
  each(x): {$eval: 'x + a'}
context:  {a: 1}
result:   [3, 5, 7]
```

The `each` function can define two variables, in which case the second is the 0-based index of the element.

```yaml,json-e
template:
  $map: [2, 4, 6]
  each(x,i): {$eval: 'x + a + i'}
context:  {a: 1}
result:   [3, 6, 9]
```

### Over Objects

When given an object, `$map` always returns an object.
The `each` function defines variables for the value and key, in that order.
It must evaluate to an object for each item.
These objects are then merged, with later keys overwriting earlier keys, to produce the final object.

```yaml,json-e
template:
  $map: {a: 1, b: 2, c: 3}
  each(v,k): {'${k}x': {$eval: 'v + 1'}}
context:  {}
result: {ax: 2, bx: 3, cx: 4}
```

If `each` is defined to take only one variable, then that variable is an object with properties `key` and `val`.

```yaml,json-e
template:
  $map: {a: 1, b: 2, c: 3}
  each(y): {'${y.key}x': {$eval: 'y.val + 1'}}
context:  {}
result: {ax: 2, bx: 3, cx: 4}
```

## `$reduce`

The `$reduce` operator evaluates an expression with each value of the given array and
the result of the prior expression, reducing the array into a single JSON value.

This operation is sometimes called `fold`, `accumulate`, `aggregate`, or `inject`.

An initial result is passed as the accumulator for the first evaluation of the expression.

The `each` function defines the accumulated, or prior result, and the current value.  The result of
this function will be passed as the accumulated to the next call of `each`.

```yaml,json-e
template:
  $reduce: [{name: Apple, price: 1}, {name: Orange, price: 0.75}, {name: Pear, price: 1.1}]
  initial: 0
  each(acc, v): {$eval: 'acc + v.price'}
context:  {}
result:   2.85
```

The `each` function can define three variables, in which case the third is the 0-based index of the element.

```yaml,json-e
template:
  $reduce: [2, 5, 8]
  initial: 0
  each(acc, v, i): {$eval: 'acc + v * 10 ** i'}
context:  {}
result:   852
```

## `$find`

The `$find` operator evaluates an expression for each value of the given array.
returning the first value for which the expression evaluates to `true`.

If there are no matches the result is either `null` or if used within an object or array, omitted
from the parent object.

```yaml,json-e  
template:
  $find: [2, 4, 6]
  each(x): x == 4
context: {}
result: 4
```

Using context variables:

```yaml,json-e
template:
  $find: [2, 4, 6]
  each(x): a == x
context: {a: 4}
result: 4
```

Omitting from parent:

```yaml,json-e
template:
  a: 1
  b:
    $find: [2, 4, 6]
    each(x): b == x
context:
  b: 3
result:
  a: 1
```

The `each` function can define two variables, in which case the second is the 0-based index of the element.

```yaml,json-e
template:
  $find: [2, 4, 6]
  each(x,i): i == 2
context: {}
result: 6
```

## `$match`

The `$match` operator is not dissimilar to pattern matching operators.  It gets
an object, in which every key is a string expression evaluating to `true`
or `false` based on the context. Keys are evaluated in lexical order, and the
result is an array containing values corresponding to keys that evaluated to
`true`.  If there are no matches, the result is an empty array.

```yaml,json-e
template:
  $match: 
    "c > 10": "cherry"
    "b > 10": "banana"
    "a > 10": "apple"
context: {a: 200, b: 3, c: 19}
result: ["apple", "cherry"]
```

```yaml,json-e
template: {$match: {"x < 10": "tens"}}
context: {x: 10}
result: []
```

## `$switch`

The `$switch` operator behaves like a combination of the `$if` and
`$match` operator for more complex boolean logic. It gets an object,
in which every key is a string expression(s), where at most *one* must
evaluate to `true` and the remaining to `false` based on the context.
The result will be the value corresponding to the key that were
evaluated to `true` or optionally the fallback `$default` value.

If there are no matches, and no `$default` fallback is provided, the
result is either null or if used within an object or array, omitted
from the parent object.

```yaml,json-e
template: {$switch: {"x == 10": "ten", "x == 20": "twenty"}}
context: {x: 10}
result: "ten"
```

```yaml,json-e
template: {$switch: {"x < 10": 1}}
context: {x: 10}
result: null
```

```yaml,json-e
template: {a: 1, b: {$switch: {"x == 10 || x == 20": 2, "x > 20": 3}}}
context: {x: 10}
result: {a: 1, b: 2}
```

```yaml,json-e
template: {a: 1, b: {$switch: {"x == 1": 2, "x == 3": 3}}}
context: {x: 2}
result: {a: 1}
```

```yaml,json-e
template: [1, {$switch: {"x == 2": 2, "x == 10": 3}}]
context: {x: 2}
result: [1, 2]
```

```yaml,json-e
template: [0, {$switch: {'cond > 3': 2, 'cond == 5': 3}}]
context:  {cond: 3}
result:   [0]
```

```yaml,json-e
template: [0, {$switch: {'cond > 3': 2, 'cond == 5': 3, $default: 4}}]
context:  {cond: 1}
result:   [4]
```

## `$merge`

The `$merge` operator merges an array of objects, returning a single object
that combines all of the objects in the array, where the right-side objects
overwrite the values of the left-side ones.

```yaml,json-e
template: {$merge: [{a: 1, b: 1}, {b: 2, c: 3}, {d: 4}]}
context:  {}
result:   {a: 1, b: 2, c: 3, d: 4}
```

## `$mergeDeep`

The `$mergeDeep` operator is like `$merge`, but it recurses into objects to
combine their contents property by property.  Arrays are concatenated.

```yaml,json-e
template:
  $mergeDeep:
    - task:
        payload:
          command: [a, b]
    - task:
        extra:
          foo: bar
    - task:
        payload:
          command: [c]
context:  {}
result:
  task:
    extra:
      foo: bar
    payload:
      command: [a, b, c]
```

## `$sort`

The `$sort` operator sorts the given array. It takes a `by(var)` property which
should evaluate to a comparable value for each element. The `by(var)` property
defaults to the identity function.

The values sorted must all be of the same type, and either a number or a string.

```yaml,json-e
template:
  $sort: [{a: 2}, {a: 1, b: []}, {a: 3}]
  by(x): 'x.a'
context:  {}
result:   [{a: 1, b: []}, {a: 2}, {a: 3}]
```

The sort is stable:

```yaml,json-e
template:
  $sort: ["aa", "dd", "ac", "ba", "ab"]
  by(x): 'x[0]'
context:  {}
# stable: all "a" strings remain in the same order relative to one another.
result:   ["aa", "ac", "ab", "ba", "dd"]
```

## `$reverse`

The `$reverse` operator simply reverses the given array.

```yaml,json-e
template: {$reverse: [3, 4, 1, 2]}
context:  {}
result:   [2, 1, 4, 3]
```

## Escaping operators

All property names starting with `$` are reserved for JSON-e.
You can use `$$` to escape such properties:

```yaml,json-e
template: {$$reverse: [3, 2, {$$eval: '2 - 1'}, 0]}
context:  {}
result:   {$reverse: [3, 2, {$eval: '2 - 1'}, 0]}
```

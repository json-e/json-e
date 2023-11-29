# Expressions

Expression are given in a simple Python- or JavaScript-like expression
language. Its data types are limited to JSON types plus function objects.

## Literals

Literals are similar to those for JSON. Numeric literals only accept integer
and decimal notation. Strings do not support any kind of escaping. The use of
`\n` and `\t` in the example below depends on the YAML parser to expand the
escapes.

```yaml,json-e
template:
  - {$eval: "1.3"}
  - {$eval: "'abc'"}
  - {$eval: '"abc"'}
  - {$eval: "'\n\t'"}
context: {}
result:
  - 1.3
  - "abc"
  - "abc"
  - "\n\t"
```

Array and object literals also look much like JSON, with bare identifiers
allowed as keys like in Javascript:

```yaml,json-e
template:
  - {$eval: '[1, 2, "three"]'}
  - {$eval: '{foo: 1, "bar": 2}'}
context: {}
result:
  - [1, 2, "three"]
  - {"foo": 1, "bar": 2}
```

## Context References

Bare identifiers refer to items from the context or to built-ins (described below).

```yaml,json-e
template: {$eval: '[x, z, x+z]'}
context: {x: 'quick', z: 'sort'}
result: ['quick', 'sort', 'quicksort']
```

## Arithmetic Operations

The usual arithmetic operators are all defined, with typical associativity and
precedence:

```yaml,json-e
template:
  - {$eval: 'x + z'}
  - {$eval: 's + t'}
  - {$eval: 'z - x'}
  - {$eval: 'x * z'}
  - {$eval: 'z / x'}
  - {$eval: 'z ** 2'}
  - {$eval: '(z / x) ** 2'}
context: {x: 10, z: 20, s: "face", t: "plant"}
result:
  - 30
  - "faceplant"
  - 10
  - 200
  - 2
  - 400
  - 4
```

Note that strings can be concatenated with `+`, but none of the other operators
apply.

## Comparison Operations

Comparisons work as expected.  Equality is "deep" in the sense of doing
comparisons of the contents of data structures.

```yaml,json-e
template:
  - {$eval: 'x < z'}
  - {$eval: 'x <= z'}
  - {$eval: 'x > z'}
  - {$eval: 'x >= z'}
  - {$eval: 'deep == [1, [3, {a: 5}]]'}
  - {$eval: 'deep != [1, [3, {a: 5}]]'}
context: {x: -10, z: 10, deep: [1, [3, {a: 5}]]}
result: [true, true, false, false, true, false]
```

## Boolean Operations

Boolean operations use C- and Javascript-style symbols `||`, `&&`, and `!`:

```yaml,json-e
template: {$eval: '!(false || false) && true'}
context: {}
result: true
```

Json-e supports short-circuit evaluation, so if in `||` left operand is true 
returning value will be true no matter what right operand is:

```yaml,json-e
template: {$eval: "true || b"}
context: {}
result: true
```

And if in `&&` left operand is false returning value will be false no matter 
what right operand is:

```yaml,json-e
template: {$eval: "false && b"}
context: {}
result: false
```

## Object Property Access

Like Javascript, object properties can be accessed either with array-index
syntax or with dot syntax. Unlike Javascript, `obj.prop` is an error if `obj`
does not have `prop`, while `obj['prop']` will evaluate to `null`.

```yaml,json-e
template: {$eval: 'v.a + v["b"]'}
context: {v: {a: 'apple', b: 'bananna', c: 'carrot'}}
result: 'applebananna'
```

Note that the object can be a literal expression:

```yaml,json-e
template: {$eval: '{ENOMEM:"Out of memory", ENOCPU:"Out of CPUs"}[msgid]'}
context: {msgid: ENOMEM}
result: 'Out of memory'
```

## Indexing and Slicing

Strings and arrays can be indexed and sliced using a Python-like indexing
scheme.  Negative indexes are counted from the end of the value.  Slices are
treated as "half-open", meaning that the result contains the first index and
does not contain the second index.  A "backward" slice with the start index
greater than the end index is treated as empty.

```yaml,json-e
template:
  - {$eval: '[array[1], string[1]]'}
  - {$eval: '[array[1:4], string[1:4]]'}
  - {$eval: '[array[2:], string[2:]]'}
  - {$eval: '[array[:2], string[:2]]'}
  - {$eval: '[array[4:2], string[4:2]]'}
  - {$eval: '[array[-2], string[-2]]'}
  - {$eval: '[array[-2:], string[-2:]]'}
  - {$eval: '[array[:-3], string[:-3]]'}
context: {array: ['a', 'b', 'c', 'd', 'e'], string: 'abcde'}
result:
  - ['b', 'b']
  - [['b', 'c', 'd'], 'bcd']
  - [['c', 'd', 'e'], 'cde']
  - [['a', 'b'], 'ab']
  - [[], '']
  - ['d', 'd']
  - [['d', 'e'], 'de']
  - [['a', 'b'], 'ab']
```

## Containment Operation

The `in` keyword can be used to check for containment: a property in an object,
an element in an array, or a substring in a string.

```yaml,json-e
template:
  - {$eval: '"foo" in {foo: 1, bar: 2}'}
  - {$eval: '"foo" in ["foo", "bar"]'}
  - {$eval: '"foo" in "foobar"'}
context: {}
result: [true, true, true]
```

## Function Invocation

Function calls are made with the usual `fn(arg1, arg2)` syntax. Functions are
not JSON data, so they cannot be created in JSON-e, but they can be provided as
built-ins or supplied in the context and called from JSON-e.


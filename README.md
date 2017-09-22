* [Full documentation](https://taskcluster.github.io/json-e)

# JSON-e

JSON-e is a data-structure parameterization system for embedding context in
JSON objects.

The central idea is to treat a data structure as a "template" and transform it,
using another data structure as context, to produce an output data structure.

There are countless libraries to do this with strings, such as
[mustache](https://mustache.github.io/). What makes JSON-e unique is that it
operates on data structures, not on their textual representation. This allows
input to be written in a number of formats (JSON, YAML, etc.) or even generated
dynamically. It also means that the output cannot be "invalid", even when
including large chunks of contextual data.

JSON-e is also designed to be safe for use on untrusted data. It never uses
`eval` or any other function that might result in arbitrary code execution. It
also disallows unbounded iteration, so any JSON-e rendering operation will
finish in finite time.

# Interface

## JavaScript

The JS module exposes following interface:

```javascript
import jsone from 'json-e';

var template = {a: {$eval: "foo.bar"}};
var context = {foo: {bar: "zoo"}};
console.log(jsone(template, context));
// -> { a: 'zoo' }
```

Note that the context can contain functions, and those functions can be called
from the template:

```javascript
var template = {$eval: "foo(1)"};
var context = {"foo": function(x) { return x + 2; }};
console.log(jsone(template, context));  // -> 3
```

*NOTE*: Context functions are called synchronously. Any complex asynchronous
operations should be handled before rendering the template.

*NOTE*: If the template is untrusted, it can pass arbitrary data to functions
in the context, which must guard against such behavior.

## Python

The Python distribution exposes a `render` function:

```python
import jsone

template = {"a": {"$eval": "foo.bar"}}
context = {"foo": {"bar": "zoo"}}
print(jsone.render(template, context))  # -> {"a": "zoo"}
```

and also allows custom functions in the context:

```python
template = {"$eval": "foo(1)"}
context = {"foo": lambda x: x + 2}
print(jsone.render(template, context))  # -> 3
```

# Language Reference

The examples here are given in YAML for ease of reading.  Of course, the
rendering operation takes place on the parsed data, so the input format is
irrelevant to its operation.

## Simple Operations

All JSON-e directives involve the `$` character, so a template without any directives is
rendered unchanged:

```yaml
context:  {}
template: {key: [1,2,{key2: 'val', key3: 1}, true], f: false}
result:   {key: [1,2,{key2: 'val', key3: 1}, true], f: false}
```

## String Interpolation

The simplest form of substitution occurs within strings, using `${..}`:

```yaml
context:  {key: 'world', num: 1}
template: {message: 'hello ${key}', 'k=${num}': true}
result:   {message: 'hello world', 'k=1': true}
```

The bit inside the `${..}` is an expression, and must evaluate to something
that interpolates obviously into a string (so, a string, number, boolean,).
If it is null, then the expression interpolates into an empty string.
The expression syntax is described in more detail below.

Values interpolate as their JSON literal values:

```yaml
context: {num: 3, t: true, f: false, nil: null}
template: ["number: ${num}", "booleans: ${t} ${f}", "null: ${nil}"]
result: ["number: 3", "booleans: true false", "null: "]
```

Note that object keys can be interpolated, too:

```yaml
context: {name: 'foo', value: 'bar'}
template: {"tc_${name}": "${value}"}
result: {"tc_foo": "bar"}
```

The string `${` can be escaped as `$${`.

## Operators

JSON-e defines a bunch of operators. Each is represented as an object with a
property beginning with `$`. This object can be buried deeply within the
template. Some operators take additional arguments as properties of the same
object.

### `$eval`

The `$eval` operator evaluates the given expression and is replaced with the
result of that evaluation. Unlike with string interpolation, the result need
not be a string, but can be an arbitrary data structure.

```yaml
context:
  settings:
    staging:
      transactionBackend: mock
    production:
      transactionBackend: customerdb
template: {config: {$eval: 'settings.staging'}}
result:   {config: {transactionBackend: 'mock'}}
```

The expression syntax is described in more detail below.

### `$json`

The `$json` operator formats the given value as JSON. It does not evaluate the
value (use `$eval` for that). While this can be useful in some cases, it is an
unusual case to include a JSON string in a larger data structure.

```yaml
context:  {a: 1, b: 2}
template: {$json: [a, b, {$eval: 'a+b'}, 4]}
result:   '["a", "b", 3, 4]'
```

### `$if` - `then` - `else`

The `$if` operator supports conditionals. It evaluates the given value, and
replaces itself with the `then` or `else` properties. If either property is
omitted, then the expression is omitted from the parent object.

```yaml
context:  {cond: true}
template: {key: {$if: 'cond', then: 1}, k2: 3}
result:   {key: 1, k2: 3}
```

```yaml
context:  {x: 10}
template: {$if: 'x > 5', then: 1, else: -1}
result:   1
```

```yaml
context: {cond: false}
template: [1, {$if: 'cond', else: 2}, 3]
result: [1,2,3]
```

```yaml
context: {cond: false}
template: {key: {$if: 'cond', then: 2}, other: 3}
result: {other: 3}
```

### `$flatten`

The `$flatten` operator flattens an array of arrays into one array.

```yaml
context:  {}
template: {$flatten: [[1, 2], [3, 4], [5]]}
result:   [1, 2, 3, 4, 5]
```

### `$flattenDeep`

The `$flattenDeep` operator deeply flattens an array of arrays into one array.

```yaml
context:  {}
template: {$flattenDeep: [[1, [2, [3]]]]}
result:   [1, 2, 3]
```

### `$fromNow`

The `$fromNow` operator is a shorthand for the built-in function `fromNow`. It
creates a JSON (ISO 8601) datestamp for a time relative to the current time or,
if `from` is given, from that time.  The offset is specified by a sequence of
number/unit pairs in a string. For example:

```yaml
context:  {}
template: {$fromNow: '2 days 1 hour'}
result:   '2017-01-19T16:27:20.974Z'
```

```yaml
context:  {}
template: {$fromNow: '1 hour', from: '2017-01-19T16:27:20.974Z'}
result:   '2017-01-19T17:27:20.974Z'
```

The available units are `day`, `hour`, and `minute`, for all of which a plural
is also accepted.

### `$let`

The `$let` operator evaluates an expression using a context amended with the
given values. It is analogous to the Haskell `where` clause.

```yaml
context: {}
template: {$let: {ts: 100, foo: 200},
           in: [{$eval: "ts+foo"}, {$eval: "ts-foo"}, {$eval: "ts*foo"}]}
result: [300, -100, 20000]
```

The `$let` operator here added the `ts` and `foo` variables to the scope of
the context and accordingly evaluated the `in` clause using those variables
to return the correct result.

### `$map`

The `$map` operator evaluates an expression for each value of the given array or object,
constructing the result as an array or object of the evaluated values.

Given an array, map returns an array, and given an object, the result is an object. When
given an object, the value of your `each` should be an object and each will be merged
internally to give the resulting object. If keys intersect, later keys will win.

```yaml
context:  {a: 1}
template:
  $map: [2, 4, 6]
  each(x): {$eval: 'x + a'}
result:   [3, 5, 7]
```

```yaml
context:  {}
template:
  $map: {a: 1, b: 2, c: 3}
  each(y): {'${y.key}x': {$eval: 'y.val + 1'}}
result: {ax: 2, bx: 3, cx: 4}
```

The array or object is the value of the `$map` property, and the expression to evaluate
is given by `each(var)` where `var` is the name of the variable containing each
element. In the case of iterating over an object, `var` will be an object with two keys:
`key` and `val`. These keys correspond to a key in the object and its corresponding value.

### `$merge`

The `$merge` operator merges an array of objects, returning a single object
that combines all of the objects in the array, where the right-side objects
overwrite the values of the left-side ones.

```yaml
context:  {}
template: {$merge: [{a: 1, b: 1}, {b: 2, c: 3}, {d: 4}]}
result:   {a: 1, b: 2, c: 3, d: 4}
```

### `$mergeDeep`

The `$mergeDeep` operator is like `$merge`, but it recurses into objects to
combine their contents property by property.  Arrays are concatenated.

```yaml
context:  {}
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
result:
  task:
    extra:
      foo: bar
    payload:
      command: [a, b, c]
```

### `$sort`

The `$sort` operator sorts the given array. It takes a `by(var)` property which
should evaluate to a comparable value for each element. The `by(var)` property
defaults to the identity function.

```yaml
context:  {}
template:
  $sort: [{a: 2}, {a: 1, b: []}, {a: 3}]
  by(x): 'x.a'
result:   [{a: 1, b: []}, {a: 2}, {a: 3}]
```

### `$reverse`

The `$reverse` operator simply reverses the given array.

```yaml
context:  {}
template: {$reverse: [3, 4, 1, 2]}
result:   [2, 1, 4, 3]
```

### Escaping operators

All property names starting with `$` are reserved for JSON-e.
You can use `$$` to escape such properties:

```yaml
context:  {}
template: {$$reverse: [3, 2, {$$eval: '2 - 1'}, 0]}
result:   {$reverse: [3, 2, {$eval: '2 - 1'}, 0]}
```

## Truthiness

Many values can be evaluated in context where booleans are required,
not just booleans themselves. JSON-e defines the following values as false.
Anything else will be true.

```yaml
context: {a: null, b: [], c: {}, d: "", e: 0, f: false}
template: {$if: 'a || b || c || d || e || f', then: "uh oh", else: "falsy" }
result: "falsy"
```

## Expression Syntax

Expression are given in a simple Python- or JavaScript-like expression
language.  Its data types are limited to JSON types plus function objects.

### Literals

Literals are similar to those for JSON.  Numeric literals only accept integer
and decimal notation. Strings do not support any kind of escaping. The use of
`\n` and `\t` in the example below depends on the YAML parser to expand the
escapes.

```yaml
context: {}
template:
  - {$eval: "1.3"}
  - {$eval: "'abc'"}
  - {$eval: '"abc"'}
  - {$eval: "'\n\t'"}
result:
  - 1.3
  - "abc"
  - "abc"
  - "\n\t"
```

Array and object literals also look much like JSON, with bare identifiers
allowed as keys like in Javascript:

```yaml
context: {}
template:
  - {$eval: '[1, 2, "three"]'}
  - {$eval: '{foo: 1, "bar": 2}'}
result:
  - [1, 2, "three"]
  - {"foo": 1, "bar": 2}
```

### Context References

Bare identifiers refer to items from the context or to built-ins (described below).

```yaml
context: {x: 'quick', z: 'sort'}
template: {$eval: '[x, z, x+z]'}
reslut: ['quick', 'sort', 'quicksort']
```

### Arithmetic Operations

The usual arithmetic operators are all defined, with typical associativity and
precedence:

```yaml
context: {x: 10, z: 20, s: "face", t: "plant"}
template:
  - {$eval: 'x + z'}
  - {$eval: 's + t'}
  - {$eval: 'z - x'}
  - {$eval: 'x * z'}
  - {$eval: 'z / x'}
  - {$eval: 'z ** 2'}
  - {$eval: '(z / x) ** 2'}
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

### Comparison Operations

Comparisons work as expected.  Equality is "deep" in the sense of doing
comparisons of the contents of data structures.

```yaml
context: {x: -10, z: 10, deep: [1, [3, {a: 5}]]}
template:
  - {$eval: 'x < z'}
  - {$eval: 'x <= z'}
  - {$eval: 'x > z'}
  - {$eval: 'x >= z'}
  - {$eval: 'deep == [1, [3, {a: 5}]]'}
  - {$eval: 'deep != [1, [3, {a: 5}]]'}
result: [true, true, false, false, true, false]
```

### Boolean Operations

Boolean operations use C- and Javascript-style symbls `||`, `&&`, and `!`:

```yaml
context: {}
template: {$eval: '!(false || false) && true'}
result: true
```

### Object Property Access

Like Javascript, object properties can be accessed either with array-index
syntax or with dot syntax. Unlike Javascript, `obj.prop` is an error if `obj`
does not have `prop`, while `obj['prop']` will evaulate to `null`.

```yaml
context: {v: {a: 'apple', b: 'bananna', c: 'carrot'}}
template: {$eval: 'v.a + v["b"]'}
result: 'applebananna'
````

### Indexing and Slicing

Strings and arrays can be indexed and sliced using a Python-like indexing
scheme.  Negative indexes are counted from the end of the value.  Slices are
treated as "half-open", meaning that the result contains the first index and
does not contain the second index.  A "backward" slice with the start index
greater than the end index is treated as empty.

```yaml
context: {array: ['a', 'b', 'c', 'd', 'e'], string: 'abcde'}
template:
  - {$eval: '[array[1], string[1]]'}
  - {$eval: '[array[1:4], string[1:4]]'}
  - {$eval: '[array[2:], string[2:]]'}
  - {$eval: '[array[:2], string[:2]]'}
  - {$eval: '[array[4:2], string[4:2]]'}
  - {$eval: '[array[-2], string[-2]]'}
  - {$eval: '[array[-2:], string[-2:]]'}
  - {$eval: '[array[:-3], string[:-3]]'}
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

### Containment Operation

The `in` keyword can be used to check for containment: a property in an object,
an element in an array, or a substring in a string.

```yaml
context: {}
template:
  - {$eval: '"foo" in {foo: 1, bar: 2}'}
  - {$eval: '"foo" in ["foo", "bar"]'}
  - {$eval: '"foo" in "foobar"'}
result: [true, true, true]
```

### Function Invocation

Function calls are made with the usual `fn(arg1, arg2)` syntax. Functions are
not JSON data, so they cannot be created in JSON-e, but they can be provided as
built-ins or in the context and called from JSON-e.

#### Built-In Functions and Variables

The expression language provides a laundry-list of built-in functions/variables. Library
users can easily add additional functions/variables, or override the built-ins, as part
of the context.

* `fromNow(offset)` or `fromNow(offset, reference)` -- JSON datestamp for a time relative to the current time or, if given, the reference time
* `now` -- the datestamp at the start of evaluation of the template. This is used implicitly as `from` in all fromNow calls. Override to set a different time.
* `min(a, b, ..)` -- the smallest of the arguments
* `max(a, b, ..)` -- the largest of the arguments
* `sqrt(x)`, `ceil(x)`, `floor(x)`, `abs(x)` -- mathematical functions
* `lowercase(s)`, `uppercase(s)` -- convert string case
* `str(x)` -- convert string, number, boolean, or array to string
* `lstrip(s)`, `rstrip(s)`, `strip(s)` -- strip whitespace from left, right, or both ends of a string
* `len(x)` -- length of a string or array


# Development and testing

## JSON-e development

You should run `npm install` to install the required packages for json-e's
execution and development.

You can run `./test.sh` to run json-e's unit tests and the `bundle.js` check.
This is a breakdown of the commands inside the `test.sh` file.

## Demo development

The demo website is a [Neutrino](https://neutrino.js.org/) app hosted in
`demo/`.  Follow the usual Neutrino development process (`yarn install && yarn
start`) there.

The resulting application embeds and enriches this README.

## Making a Release

* Update the version, commit, and tag -- `npm version patch` (or minor or major, depending)
* Push to release the JS version -- `git push && git push --tags`
* Release to PyPi:
  * `python setup.py sdist`
  * `twine upload dist/json-e-<version>.tar.gz`

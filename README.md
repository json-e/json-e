# [JSON-e](https://taskcluster.github.io/json-e)

JSON-e is a data-structure parameterization system written for embedding
context in JSON objects.

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
console.log(jsone(template, context));
// -> 3
```

# Language

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

The simplest form of substitution occurs within strings, using `${..}`:

```yaml
context:  {key: 'world', num: 1}
template: {message: 'hello ${key}', 'k=${num}': true}
result:   {message: 'hello world', 'k=1': true}
```

The bit inside the `${..}` is an expression, and must evaluate to something
that interpolates obviously into a string (so, a string, number, boolean, or
null). The expression syntax is described in more detail below.

Values interpolate as their JSON literal values:

```yaml
context: {num: 3, t: true, f: false, nil: null}
template: ["number: ${num}", "booleans: ${t} ${f}", "null: ${nil}"]
result: ["number: 3", "booleans: true false", "null: null"]
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

The name `$dumps` is allowed as a synonym of `$json`, but its use is
not recommended -- `$json` is the preferred spelling.

### Truthiness

Many values can be evaluated in context where booleans are required,
not just booleans themselves. JSON-e defines the following values as false.
Anything else will be true.

```yaml
context: {a: null, b: [], c: {}, d: "", e: 0, f: false}
template: {$if: 'a || b || c || d || e || f', then: "uh oh", else: "falsy" }
result: "falsy"
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
creates a JSON (ISO 8601) datestamp for a time relative to the current time.
The offset is specified by a sequence of number/unit pairs in a string. For
example:

```yaml
context:  {}
template: {$fromNow: '2 days 1 hour'}
result:   '2017-01-19T16:27:20.974Z'
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

The `$map` operator evaluates an expression for each value of the given array,
constructing the result as an array of the evaluated values.

```yaml
context:  {a: 1}
template:
  $map: [2, 4, 6]
  each(x): {$eval: 'x + a'}
result:   [3, 5, 7]
```

The array is the value of the `$map` property, and the expression to evaluate
is given by `each(var)` where `var` is the name of the variable containing each
element.

### `$merge`

The `$merge` operator merges an array of objects, returning a single object
that combines all of the objects in the array, where the right-side objects
overwrite the values of the left-side ones.

```yaml
context:  {}
template: {$merge: [{a: 1, b: 1}, {b: 2, c: 3}, {d: 4}]}
result:   {a: 1, b: 2, c: 3, d: 4}
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

## Escaping operators

You can use `$$` to escape json-e operators. For example:

```yaml
context:  {}
template: {$$reverse: [3, 2, {$$eval: '2 - 1'}, 0]}
result:   {$reverse: [3, 2, {$eval: '2 - 1'}, 0]}
```

## Expressions

Expression are given in a simple Python- or JavaScript-like language. It
supports the following:

* Numeric literals (decimal only)
* String literals (enclosed in `'` or `"`, with no escaping)
* Arrays in JSON format (`[.., ..]`)
* Objects in JS format: `{"foo": 10}` or `{foo: 10}`
* Parentheses for grouping (`(a + b) * c`)
* Arithmetic on integers (`+`, `-`, `*`, `/`, `**` for exponentiation), with unary `-` and `+`
* String concatenation (`+`)
* Comparison of strings to strings or numbers to numbers (`<`, `<=`, `>`, `>=`)
* Equality of anything (`==`, `!=`)
* Boolean operators (`||`, `&&`, `!`)
* Identifiers referring to variables (matching `/[a-zA-Z_][a-zA-Z_0-9]*/`)
* Object property access: `obj.prop` or `obj["prop"]`
  * `obj,prop` is an error if there is no such property; in the same case `obj["prop"]` evaluates to `null`.
* Array and string indexing and slicing with Python semantics
  * `array[1]` -- second element of array (zero-indexed)
  * `array[1:4]` -- second through fourth elements of the array (the slice includes the left index and excludes the right index)
  * `array[1:]` -- second through last element of the array
  * `array[:3]` -- first through third element of the array
  * `array[-2:]` -- the last two elements of the array
  * `array[:-1]` -- all but the last element of the array
  * `string[3]` -- fourth character of the string
  * `string[-4:]` -- all but the last four characters of the string
* Containment operator:
  * `"string" in object` -- true if the object has the given property
  * `"string" in array` -- true if the string is an array element
  * `number in array` -- true if the number is an array element
  * `"string" in "another string"` -- true if the first string is a substring of the second
* Function invocation: `fn(arg1, arg2)`

### Built-In Functions

The expression language provides a laundry-list of built-in functions. Library
users can easily add additional functions, or override the built-ins, as part
of the context.

* `fromNow(x)` -- JSON datestamp for a time relative to the current time
* `min(a, b, ..)` -- the smallest of the arguments
* `max(a, b, ..)` -- the largest of the arguments
* `sqrt(x)`, `ceil(x)`, `floor(x)`, `abs(x)` -- mathematical functions
* `lowercase(s)`, `uppercase(s)` -- convert string case
* `str(x)` -- convert string, number, boolean, or array to string
* `len(x)` -- length of a string or array

### Custom Functions

The context supplied to JSON-e can contain JS function objects. These will be
available just like the built-in functions are.  For example:

```js
var context = {
  imageData: function(img) {
    return ...;
  },
};

var template = {
  title: "Trip to Hawaii",
  thumbnail: {$eval: 'imageData("hawaii")'},
};

return jsone(template, context);
```

NOTE: Context functions are called synchronously. Any complex asynchronous
operations should be handled before rendering the template.

NOTE: If the template is untrusted, it can pass arbitrary data to functions
in the context, which must guard against such behavior. For example, if the
`imageData` function above reads data from a file, it must sanitize the
filename before opening it.

# Development and testing

You should run `npm install` to install the required packages for json-e's
execution and development.

You can run `./test.sh` to run json-e's unit tests and the `bundle.js` check.
This is a breakdown of the commands inside the `test.sh` file.

```bash
# Run JavaScript unit tests
npm test

# Run Python unit tests
python setup.py test

# bundle.js check. This section makes sure that
# the demo website's bundle.js file is updated.
mv docs/bundle.js docs/bundle.diff.js
npm run-script build-demo
diff docs/bundle.js docs/bundle.diff.js
```

You can also run the following command to
update the demo website bundle.js file.

```bash
npm run-script build-demo
```

# Built-In Functions and Variables

The expression language provides a laundry-list of built-in functions/variables. Library
users can easily add additional functions/variables, or override the built-ins, as part
of the context.

## Time

The built-in context value `now` is set to the current time at the start of
evaluation of the template, and used as the default "from" value for `$fromNow`
and the built-in `fromNow()`.

```yaml,json-e
template:
  - {$eval: 'now'}
  - {$eval: 'fromNow("1 minute")'}
  - {$eval: 'fromNow("1 minute", "2017-01-19T16:27:20.974Z")'}
context: {}
result:
  - '2017-01-19T16:27:20.974Z'
  - '2017-01-19T16:28:20.974Z'
  - '2017-01-19T16:28:20.974Z'
```

## Math

```yaml,json-e
template:
  # the smallest of the arguments
  - {$eval: 'min(1, 3, 5)'}
  # the largest of the arguments
  - {$eval: 'max(2, 4, 6)'}
  # mathematical functions
  - {$eval: 'sqrt(16)'}
  - {$eval: 'ceil(0.3)'}
  - {$eval: 'floor(0.3)'}
  - {$eval: 'abs(-0.3)'}
context: {}
result:
  - 1
  - 6
  - 4
  - 1
  - 0
  - 0.3
```

## Strings

```yaml,json-e
template:
  # convert string case
  - {$eval: 'lowercase("Fools!")'}
  - {$eval: 'uppercase("Fools!")'}
  # convert string, number, or boolean to string
  # (arrays and objects cannot be converted to string)
  - {$eval: 'str(130)'}
  # convert a string to a number (string is required)
  - {$eval: 'number("310")'}
  # strip whitespace from left, right, or both ends of a string
  - {$eval: 'lstrip("  room  ")'}
  - {$eval: 'rstrip("  room  ")'}
  - {$eval: 'strip("  room  ")'}
  - {$eval: 'split("left:right", ":")'}
context: {}
result:
  - "fools!"
  - "FOOLS!"
  - "130"
  - 310
  - "room  "
  - "  room"
  - room
  - [left, right]
```

## Arrays

```yaml,json-e
template:
  - {$eval: 'join(["carpe", "diem"], " ")'}
  - {$eval: 'join([1, 3], 2)'}
context: {}
result:
  - carpe diem
  - '123'
```

## Context

The `defined(varname)` built-in determines if the named variable is defined in the current context.
The current context includes any variables defined or redefined by `$let` or similar operators.
Note that the name must be given as a string.

```yaml,json-e
template: {$if: 'defined("x")', then: {$eval: 'x'}, else: 20}
context: {y: 10}
result: 20
```

## Type

The `typeof()` built-in returns the type of an object. Its behavior around
`null` is reminiscent of JavaScript.

```yaml,json-e
template:
 - "${typeof('abc')}"
 - "${typeof(42)}"
 - "${typeof(42.0)}"
 - "${typeof(true)}"
 - "${typeof([])}"
 - "${typeof({})}"
 - "${typeof(typeof)}"
 - {$eval: "typeof(null)"}
 - "${typeof(null)}"
context: {}
result:
 - string
 - number
 - number
 - boolean
 - array
 - object
 - function
 - 'null'
 - 'null'    # .. which interpolates to an empty string
```

## Length

The `len()` built-in returns the length of a string or array.

```yaml,json-e
template: {$eval: 'len([1, 2, 3])'}
context: {}
result: 3
```

## Range

The `range()` built-in generates an array based on the following inputs:
* `start` - An integer specifying the lower bound of the range (inclusive).
  This can be negative.
* `end` - An integer specifying the upper bound of the range (exclusive). This
  can be negative.
* `step` - Optional. An integer specifying a step to apply to each value within
  the range. If not specified, defaults to `1`. Can be negative.

For a positive step, the contents of a range r are determined by the formula
r[i] = start + step*i where i >= 0 and r[i] < end.

For a negative step, the contents of the range are still determined by the
formula r[i] = start + step*i, where i >= 0 and r[i] > end.

```yaml,json-e
template:
  $map: {$eval: 'range(1, 5)'}
  each(x): {$eval: 'x'}
context:  {}
result:   [1, 2, 3, 4]
```

# Simple Usage

All JSON-e directives involve the `$` character, so a template without any directives is
rendered unchanged:

```yaml,json-e
template: {key: [1,2,{key2: 'val', key3: 1}, true], f: false}
context:  {}
result:   {key: [1,2,{key2: 'val', key3: 1}, true], f: false}
```

## String Interpolation

The simplest form of substitution occurs within strings, using `${..}`:

```yaml,json-e
template: {message: 'hello ${key}', 'k=${num}': true}
context:  {key: 'world', num: 1}
result:   {message: 'hello world', 'k=1': true}
```

The bit inside the `${..}` is an [expression](./expressions.html), and must evaluate to something
that interpolates obviously into a string (a string, number, or boolean).
If it is null, then the expression interpolates into an empty string.

Values interpolate as their JSON literal values:

```yaml,json-e
template: ["number: ${num}", "booleans: ${t} ${f}", "null: ${nil}"]
context: {num: 3, t: true, f: false, nil: null}
result: ["number: 3", "booleans: true false", "null: "]
```

Note that object keys can be interpolated, too:

```yaml,json-e
template: {"tc_${name}": "${value}"}
context: {name: 'foo', value: 'bar'}
result: {"tc_foo": "bar"}
```

The string `${` can be escaped as `$${`:

```yaml,json-e
template: {"literal:$${name}": "literal"}
context: {name: 'foo'}
result: {"literal:${name}": "literal"}
```

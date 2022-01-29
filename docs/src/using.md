# Using JSON-e

JSON-e is intended for cross-platform usage, and has native implementations in several languages.

## JavaScript

The JS module is installed into a Node project with

```shell
npm install --save json-e
yarn add json-e
```

The module exposes following interface:

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

### Browser

JSON-e has a single-file, browser-compatible implementation in `dist/index.js` in the NPM release.
This file can be used directly in a browser to add JSON-e functionality.

JSON-e can be used from a CDN with

```html
<script
  type="text/javascript"
  src="https://cdn.jsdelivr.net/npm/json-e">
</script>
```

## TypeScript

The JS module is installed with either of

```shell
npm install --save json-e
yarn add json-e
```

Note: Type definitions are included with this package, so there's no need of seperate
`@types/..` installation.

As 'json-e' is a CommonJS module, the package must be imported like this [(more..)](https://www.typescriptlang.org/docs/handbook/modules.html#export--and-import--require) for type definitions to work properly:

```typescript
const jsone = require('json-e');

var template = {a: {$eval: "foo.bar"}};
var context = {foo: {bar: "zoo"}};
console.log(jsone(template, context));
// -> { a: 'zoo' }
```

## Python

The Python distribution is installed with

```shell
pip install json-e
```

The distribution exposes a `render` function:

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

## Go (golang)

The [golang package for json-e](https://pkg.go.dev/github.com/json-e/json-e) exposes a `Render` function:

```golang
import (
  "fmt"
  "github.com/json-e/json-e"
)

// Template must be given using types:
//   map[string]interface{}, []interface{}, float64, string, bool, nil
// The same types that json.Unmarshal() will create when targeting an interface{}
template := map[string]interface{}{
  "result": map[string]interface{}{
    "$eval": "f() + 5",
  },
}
// Context can be JSON types just like template, but may also contain functions
// these can JSON types as arguments, and return a value and optionally an error.
context := map[string]interface{}{
  "f": func() int { return 37 },
}

func main() {
  value, err := jsone.Render(template, context)
  fmt.Printf("%#v\n", value)
}
```

## Rust

The Rust crate exposes a `render` function which takes the template and context as `serde_json` `Value` objects, and returns an object of the same type.

```rust,ignore
use serde_json::json;

fn main() {
    println!("result: {:?}", json_e::render(
        json!({$eval: "a + b"}),
        json!({a: 10, b: 20})));
}
```

See [docs.rs](https://docs.rs/json-e) for the full API docs.

## Third-Party Integrations

### rjsone

You can use the 3rd party package [rjsone](https://wryun.github.io/rjsone/) to template
JSON-e from the command line, passing templates/contexts as files or arguments and using
stdout for the result.

### Bazel

You can use 3rd party [Bazel rule](https://github.com/atlassian/bazel-tools/tree/master/rjsone) to invoke
rjsone (see above) from Bazel build files.

### Terraform

The [jsone Terraform provider](https://github.com/taskcluster/terraform-provider-jsone) allows use of JSON-e for templating objects within Terraform.


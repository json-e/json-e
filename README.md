# JSON-e

JSON-e is a data-structure parameterization system written for embedding
context in a JSON objects.

The central idea is to treat a data structure as a "template" and transform it,
using another data structure as context, to produce an output data structure.

There are countless libraries to do this with strings, such as
[mustache](https://mustache.github.io/). What makes JSON-e unique is that it
operates on data structures, not on their textual representation. This allows
input to be written in a number of formats (JSON, YAML, etc.) or even generated
dynamically.

# Interface

The JS module exposes following interface:

```javascript
import jsone from 'json-e';

var template = {a: {$eval: "foo.bar"}};
var context = {foo: {bar: "zoo"}};
console.log(jsone(template, context));
// -> { a: 'zoo' }
```

# Language

*TODO*: document language features (use github-pages?)

See `specification.yml` for now.

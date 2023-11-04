# Language Reference

The following sections describe the JSON-e language.

The examples here are given in YAML for ease of reading.  Of course, the
rendering operation takes place on the parsed data, so the input format is
irrelevant to its operation.

## Rendering

A JSON-e template is rendered with a context to produce a result. The
template, context, and result are all data structures containing strings,
numbers, true/false, null, objects, and arrays -- the type of data structure
you get from parsing JSON.

The context is an object, giving values for variables at the top level of the
template. JSON-e defines a few such variables, too, documented in the
[Built-Ins](./built-ins.md) section. Some operators, such as `$let`, allow the
template to define additional variables during rendering.

The context can contain functions defined by the caller. While these functions
can be used during rendering, they cannot appear in the result.

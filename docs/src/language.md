# Language Reference

The following sections describe the JSON-e language.

The examples here are given in YAML for ease of reading.  Of course, the
rendering operation takes place on the parsed data, so the input format is
irrelevant to its operation.

## Rendering

A JSON-e template is rendered with a context to produce a result. The template,
context, and result are all data structures containing strings, numbers,
true/false, null, objects, and arrays -- the type of data structure you get
from parsing JSON.

The context is an object, giving values for variables at the top level of the
template.

## Variables and Scope

Variables are defined in a set of nested scopes. When an
[expression](./expressions.md) references a variable, evaluation looks for a
variable of that name in all scopes, from innermost to outermost, and uses the
first that it finds.

The outermost scope are the [built-ins](./built-ins.md). The context passed to
the render call is used as the next scope, an thus can override built-in
variables. Some operators, such as `$let`, allow the template to define
additional scopes during rendering.

Variables can contain functions defined by the caller. While these functions
can be used during rendering, it is an error for them to appear in the result.

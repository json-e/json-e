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

## Language Definition and Implementations

This repository defines both the JSON-e language and contains several
implementations of that language.

The language definition is embodied in [`./specification.yml`](./specification.yml) and the
documentation for the language constructs.

The language and implementations are all versioned together, following semantic
versioning.  Breaking changes to the language specification are not common, and
typically result from bugfixes rather than new features.  Generally, you may
consider the language stable.

Any discrepancy in behavior between the implementations that is not documented
as undefined behavior is considered a bug.  If fixing that bug can cause
backward incompatibility in an implementation, then the change may be considered
breaking and be released with a new major version.

## Full Documentation

See [json-e.js.org](https://json-e.js.org).

## Changes

See
[CHANGELOG.rst](https://github.com/json-e/json-e/blob/main/CHANGELOG.rst)
for the changes in each version of this library.

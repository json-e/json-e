# Contributing to JSON-e

We welcome pull requests from everyone. We do expect everyone to adhere to the [Mozilla Community Participation Guidelines][participation].

If you're trying to figure out what to work on, have a look at the [open issues][issues].
If you're unsure about how to proceed on an existing issue, feel free to add a comment to it.

JSON-e is a data-structure parameterization system for embedding context in
JSON objects. It operates on data structures directly (not strings), ensuring
output validity and safety (no eval, no unbounded iteration).

JSON-e is implemented in several languages. All implementations should behave
identically, and the test suite subjects each implementation to the same
requirements (in `specification.yml`). Developing JSON-e will usually require
you to make changes in all implementations.

## JavaScript

The JavaScript implementation is located in `./js`

Within that directory, run `yarn install` to install the required packages for JSON-e's execution and development.
To run the tests use `yarn test`

There are also a few other useful commands:

```bash
cd js && yarn lint             # eslint only
cd js && yarn rollup           # bundle for browser (UMD)
```

## Python

The Python implementation is located in `./py`.

To test this implementation, install and run `tox` within that directory.
This will test on all supported Python versions.
If you have fewer Python versions installed, that's OK -- when you make a PR it will run for all versions.

You can also run tests more selectively:

```bash
cd py && tox -e py311          # run tests on a single Python version
cd py && tox -e lint           # run black formatter check
cd py && pytest                # run tests directly (requires deps installed)
```

## Go

The Go implementation is located in `internal/`, with a small stub in `jsone.go` in the root directory.
This follows the usual GoModules form, so running `go test ./...` in the root dir will run the tests.

For linting, use `golangci-lint run`.

## Rust

The Rust implementation is in `rs/`.
Within that directory, you will find a `Cargo.toml` and the usual Rust development tools apply: `cargo test`, `cargo build`, and so on.
You can also run `cargo clippy` for linting.

## Architecture

Each implementation follows the same general architecture:

1. A **tokenizer** breaks expression strings into tokens
2. A **Pratt parser** produces an AST
3. An **interpreter** evaluates AST nodes in a context
4. A **renderer** walks JSON templates, recognizes `$`-operators (`$if`, `$eval`, `$map`, etc.), and recursively renders
5. **Builtins** provide functions available in expressions (`min`, `max`, `len`, `lowercase`, `fromNow`, etc.)

`specification.yml` in the repo root is the single source of truth. It defines
the JSON-e language through hundreds of test cases (template + context →
expected result or error). All four implementations load and run these same
tests, ensuring behavioral consistency — any discrepancy is a bug.

Here's where the key components live in each implementation:

| Component | JS | Python | Go | Rust |
|---|---|---|---|---|
| Entry/Renderer | `js/src/index.js` | `py/jsone/render.py` | `internal/jsone.go` | `rs/src/render.rs` |
| Parser | `js/src/parser.js` | `py/jsone/parser.py` | `internal/interpreter/parser/parser.go` | `rs/src/interpreter/parser.rs` |
| Interpreter | `js/src/interpreter.js` | `py/jsone/interpreter.py` | `internal/interpreter/interpreter.go` | `rs/src/interpreter/evaluator.rs` |
| Builtins | `js/src/builtins.js` | `py/jsone/builtins.py` | `internal/jsone.go` (inline) | `rs/src/builtins.rs` |

The Go public API in `jsone.go` (root) is a thin wrapper around `internal/`.

The spec tests are loaded slightly differently in each language:

- **JS**: `js/test/specification_test.js` parses the YAML and creates mocha suites
- **Python**: `py/test/test_specification.py` uses pytest parametrize from the YAML
- **Go**: `internal/jsone_test.go` loads the YAML and runs subtests
- **Rust**: `rs/build.rs` generates test source at compile time from the YAML

# Documentation

The documentation uses [mdBook](https://rust-lang.github.io/mdBook/), with source files in `docs/`.
For the most part, it's fine to modify documentation without running `mdbook`, following the examples elsewhere in the file.

To use the playground, you will need to roll up the browser-compatible version of JSON-e:

```
cd js
yarn
yarn rollup
```

# Changelog

When making a pull request with your changes, create a new file in
`newsfragments/` named after the issue or bug you are working on, with a suffix
of `.bugfix`, `.feature`, or (for docs-only changes) `.doc`.  The content of
this file should be in reStructuredText format. Keep it to a simple sentence,
and you should be fine!

For example, `newsfragments/201.bugfix` might contain `Fixed the precedence of
the || and 'in' operators`.

Note that test time is frozen to `2017-01-19T16:27:20.974Z` across all implementations.

Welcome to the team!

[participation]: https://www.mozilla.org/en-US/about/governance/policies/participation/
[issues]: ../../issues

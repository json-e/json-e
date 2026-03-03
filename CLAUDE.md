# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JSON-e is a data-structure parameterization system for embedding context in JSON objects. It operates on data structures directly (not strings), ensuring output validity and safety (no eval, no unbounded iteration). It is implemented identically in four languages: JavaScript, Python, Go, and Rust.

## Build & Test Commands

### JavaScript (`js/`)
```bash
cd js && yarn install          # install dependencies
cd js && yarn test             # lint + run tests (mocha, TDD-style)
cd js && yarn lint             # eslint only
cd js && yarn rollup           # bundle for browser (UMD)
```

### Python (`py/`)
```bash
cd py && tox                   # run tests on all Python versions
cd py && tox -e py311          # run tests on a single Python version
cd py && tox -e lint           # run black formatter check
cd py && pytest                # run tests directly (requires deps installed)
```

### Go (root directory)
```bash
go test ./...                  # run all tests
go test -v -race ./...         # verbose with race detection
golangci-lint run              # lint
```

### Rust (`rs/`)
```bash
cd rs && cargo test            # run tests
cd rs && cargo clippy          # lint
cd rs && cargo build           # build
```

## Architecture

### Specification-Driven Development

`specification.yml` in the repo root is the single source of truth. It defines the JSON-e language through hundreds of test cases (template + context → expected result or error). All four implementations load and run these same tests, ensuring behavioral consistency. **All implementations must behave identically** — any discrepancy is a bug.

### Shared Component Structure

Each implementation follows the same architecture:

1. **Tokenizer** — breaks expression strings into tokens
2. **Parser** — Pratt parser producing an AST
3. **Interpreter** — evaluates AST nodes in a context
4. **Renderer** — walks JSON templates, recognizes `$`-operators (`$if`, `$eval`, `$map`, etc.), recursively renders
5. **Builtins** — functions available in expressions (`min`, `max`, `len`, `lowercase`, `fromNow`, etc.)

### Implementation Locations

| Component | JS | Python | Go | Rust |
|---|---|---|---|---|
| Entry/Renderer | `js/src/index.js` | `py/jsone/render.py` | `internal/jsone.go` | `rs/src/render.rs` |
| Parser | `js/src/parser.js` | `py/jsone/parser.py` | `internal/interpreter/parser/parser.go` | `rs/src/interpreter/parser.rs` |
| Interpreter | `js/src/interpreter.js` | `py/jsone/interpreter.py` | `internal/interpreter/interpreter.go` | `rs/src/interpreter/evaluator.rs` |
| Builtins | `js/src/builtins.js` | `py/jsone/builtins.py` | `internal/jsone.go` (inline) | `rs/src/builtins.rs` |

The Go public API in `jsone.go` (root) is a thin wrapper around `internal/`.

### How Spec Tests Are Loaded

- **JS**: `js/test/specification_test.js` — parses YAML, creates mocha suites
- **Python**: `py/test/test_specification.py` — pytest parametrize from YAML
- **Go**: `internal/jsone_test.go` — loads YAML, runs as subtests
- **Rust**: `rs/build.rs` — generates test source at compile time from YAML

## PR/Contribution Conventions

- Changes typically require updates across all four implementations
- New functionality/bugfixes need new test cases in `specification.yml`
- Changelog entries go in `newsfragments/<issue>.<type>` (`.bugfix`, `.feature`, or `.doc`) in reStructuredText format
- Test time is frozen to `2017-01-19T16:27:20.974Z` across all implementations

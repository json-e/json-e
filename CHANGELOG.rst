Jsone 4.6.0 (2023-11-21)
========================

Bugfixes
--------

- For JavaScript, variables added in a `$let` do not persist outside of that `$let` any more. (#473)
- The context is required to be a JSON object in all implementations. (#481)
- Python versions older than 3.8 are no longer tested or supported. Notably, Python 2 is no longer supported. (#486)


Improved Documentation
----------------------

- All of the time-range abbreviations supported by `fromNow` and `$fromNow` are
  now documented, and all implementations agree on those abbreviations. (#483)


Jsone 4.5.3 (2023-07-27)
========================

Bugfixes
--------

- Upgraded Rust parser-builder `nom` to major version 7. (#462)
- Fix Rust JSON conversions for floats of small magnitude (#466)


Jsone 4.5.2 (2023-04-10)
========================

Bugfixes
--------

- Fixed a bug that caused some examples in documentation not to be rendered on json-e.js.org (#461)


Jsone 4.5.1 (2023-03-20)
========================

- The Rust crate no longer rebuilds on every invocation. (#460)


Jsone 4.5.0 (2022-12-25)
========================

Features
--------

- Added a $default case to the switch operator (#455)


Jsone 4.4.3 (2021-11-17)
========================

Features
--------

- The JSON-e GitHub repository has been moved to https://github.com/json-e/json-e. (#430)


Bugfixes
--------

- Emit an error on uncalled functions in all implementations. (#158)
- All implementations now enforce that context is an object.  This was always the intent, but the JS and Python implementations' validation was not particularly thorough. (#408)


Jsone 4.4.1 (2021-03-12)
========================

No significant changes.

This version updates the release mechanics to include descriptions for each package.


Jsone 4.4.0 (2021-03-12)
========================

Features
--------

- JSON-e is now also available as a Rust crate! (#289)
- Each implementation language is now in its own subdirectory.  This change should not affect users of the library. (#401)


Bugfixes
--------

- Syntax errors regarding unexpected identifiers are now phrased more clearly (Python and JS implementations only) (#383)
- JS implementation now throws instances of the correct SyntaxError type (#399)


Jsone 4.3.0 (2020-08-27)
========================

Features
--------

- Introduces `split` to built-in string functions enabling string splitting with a delimiter. 
  Input and delimiter can either be `string` or `number`. (#368)
- Introduces join to the built-in functions to join lists with a seperator. list items and separator can either be string or number. (#370)
- The Go port now uses GoModules.  It should nonetheless remain compatible with earlier versions of Go. (#373)


Jsone 4.2.0 (2020-07-17)
========================

Bugfixes
--------

- The Python implementation no longer causes warnings about invalid escape sequences (#361).

Jsone 4.1.0 (2020-05-29)
========================

Features
--------

- Introduces $switch operator, which behaves like a combination of the $if and $match operator for
  more complex boolean logic. It gets an object, in which every key is a string expression(s), where
  at most one must evaluate to true and the remaining to false based on the context. The result will be
  the value corresponding to the key that were evaluated to true. (#257)


Bugfixes
--------

- Builtin functions are now called with relevant context.
  This means that builtins like `fromNow()` and `defined()` respect variables defined via `$let`. (342&343)
- Fix error (constructor.name) when using with Webpack in production mode (#354)


Improved Documentation
----------------------

- The `defined()` builtin is now documented. (#341)
- Tests now include a test case for #354, regarding function evaluation. (#354)


Jsone 4.0.1 (2020-03-11)
========================

Bugfixes
--------

- Revert PR # 330 (fix for issue 158)

Improved Documentation
----------------------

- Update releasing documentation with information on how to release on npm and deploy the web-site (release)


Jsone 4.0.0 (2020-03-04)
===================

Bugfixes
--------

- Added support for the short-circuiting of the boolean logic operators || and &&
  Separated parser and interpreter.
  Parser build an abstract syntax tree.
  Interpreter make tree traversal. (#244)


Jsone 3.0.2 (2020-03-03)
========================

Bugfixes
--------

- ## Part fix for #168: Enforce all error messages match

  Made sure error messages for arithmetic operations, builtins, and strings are the same.

  Added error messages for array indexing. (#168)
- Fixed the issue of speacial values in '$let' not evaluating.

  Values like 'if-then-else' statements, '$eval', and rendered keys.
  The values evaluate to an object, the values of which are evaluated.
  For example, the operations below no longer return an error:

  title: let with a value of $if-then-else
  $let:
    $if: something == 3
    then: {a: 10, b: 10}
    else: {a: 20, b: 10}
  in:
    $eval: 'a + b'

  context: {'something': 3}
  result:  20

  -----

  title: let using values from the parent context
  $let:
    "b": {$eval: "a + 10"}
  in:
    $eval: 'a + b'

  context: {'a':5}
  result:  20

  -----

  title: let with a rendered key
  $let:
    "first_${name}": 1
    "second_${name}": 2
  in:
    {$eval: "first_prize + second_prize"}

  context: {'name': "prize"}
  result:  3 (#249)
- Throw a useful error for `$then` (#252)
- Do not import `assert` in non-test code, so that it can run on browsers (#266)
- Differentiate path/variable from the rest of the error message (#283)
- [JS] Use `json-stable-stringify-without-jsonify`, dropping use of the unlicensed `jsonify`. (#299)
- Better error message when indexing string or array with non integer (#318)
- Strings containing unicode are now handled correctly by str() on Python 2. (#338)


Improved Documentation
----------------------

- Fix typo in CONTRIBUTING.md (contributingmd)
- Clarify 'all tests pass' instruction in PULL_REQUEST_TEMPLATE.md (pull_request_template)
- The `$fromNow` builtin is tested to properly handle a new value of `now` defined in a `$let`. (#344)


Jsone 3.0.1 (2018-07-11)
========================

Features
--------

- Introduction of support of TypeScript typings. This version adds type for the jsone function.

Jsone 3.0.0 (2018-11-01)
========================

Features
--------

- Support of `index` or `key` context variable in `$map` operation.

  ```yaml
  template:
    $map: [2, 4, 6]
    each(x,i): {$eval: 'x + a + i'}
  context:  {a: 1}
  result:   [3, 6, 9]
  ---
  template:
    $map: {a: 1, b: 2, c: 3}
    each(v,k): {'${k}x': {$eval: 'v + 1'}}
  context:  {}
  result: {ax: 2, bx: 3, cx: 4}
  ``` (#235)
- Add support for element indexes in $map (#242)


Bugfixes
--------

- [BREAKING] make typeof(null) be "null", not null

  This is a breaking change, as it changes an existing, documented behavior.
  However, it is unlikely to affect most uses of JSON-e. (#246)


Jsone 2.7.1 (2018-09-22)
========================

Bugfixes
--------

- Ensure that `$match` results are deterministic (#258)


Jsone 2.7.0 (2018-08-23)
========================

Features
--------

- Add new operator `$match` which allows for a new way of flow control by evaluating boolean expressions it is given. (#161)


Jsone 2.6.0 (2018-06-20)
========================

Features
--------

- Begin using towncrier to build CHANGELOG.rst (#193)
- Add a `number` builtin that converts strings to numbers (#240)


Bugfixes
--------

- Ensure that ``$json`` consistently sorts object properties across languages
  (#222)


Improved Documentation
----------------------

- Link to rjsone in README (#238)


Older Versions
==============

For versions of JSON-e 2.5.0 and older, please consult the git history.

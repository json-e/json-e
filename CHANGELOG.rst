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

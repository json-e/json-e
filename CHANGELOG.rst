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

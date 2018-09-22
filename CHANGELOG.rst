Jsone  (2018-09-22)
===================

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

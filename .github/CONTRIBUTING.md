# JSON-e development

JSON-e is implemented in several languages. All implementations should behave
identically, and the test suite subjects each implementation to the same
requirements (in `specification.yml`). Developing JSON-e will usually require
you to make changes in all implementations.

You can run `./test.sh` to run json-e's tests and lint checks across all
implementations.

## JavaScript

You should run `npm install` to install the required packages for JSON-e's
execution and development.

## Python

For Python, activate a virtualenv and run `pip install -e .`.

To run the Python tests only, use `python setup.py test`.

Note that JSON-e supports both Python 2 and Python 3.

# Demo development

The demo website is a [Neutrino](https://neutrino.js.org/) app hosted in
`demo/`.  Follow the usual Neutrino development process (`yarn install && yarn
start`) there.

The resulting application embeds and enriches the README file.

# Changelog

When making a pull request with your changes, create a new file in
`newsfragments/` named after the issue or bug you are working on, with a suffix
of `.bugfix`, `.feature`, or (for docs-only changes) `.doc`.  The content of
this file should be in reStructuredText format. Keep it to a simple sentence,
and you should be fine!

For example, `newsfragments/201.bugfix` might contain `Fixed the precedence of
the || and 'in' operators`.

# General Taskcluster Contribution

We welcome pull requests from everyone. We do expect everyone to adhere to the [Mozilla Community Participation Guidelines][participation].

If you're trying to figure out what to work on, here are some places to find suitable projects: 
* [Good first bugs][goodfirstbug]: these are scoped to make it easy for first-time contributors to get their feet wet with Taskcluster code.
* [Mentored bugs][bugsahoy]: these are slightly more involved projects that may require insight or guidance from someone on the Taskcluster team.
* [Full list of open issues][issues]: everything else

If the project you're interested in working on isn't covered by a bug or issue, or you're unsure about how to proceed on an existing issue, it's a good idea to talk to someone on the Taskcluster team before you go too far down a particular path. You can find us in the #taskcluster channel on [Mozilla's IRC server][irc] to discuss. You can also simply add a comment to the issue or bug.

Once you've found an issue to work on and written a patch, submit a pull request. Some things that will increase the chance that your pull request is accepted:

* Follow our [best practices][bestpractices].
* This includes [writing or updating tests][testing].
* Write a [good commit message][commit].

# JSON-e Contribution

JSON-e is implemented in several languages. All implementations should behave
identically, and the test suite subjects each implementation to the same
requirements (in `specification.yml`). Developing JSON-e will usually require
you to make changes in all implementations.

## JavaScript

The JavaScript implementation is located in `./src`

You should run `npm install` to install the required packages for JSON-e's
execution and development.

To run the tests use `npm test`

## Python

The Python implementation is located in `./jsone`.

For Python, activate a virtualenv and run `pip install -e .`.

To run the Python tests only, use `python setup.py test`.

Note that JSON-e supports both Python 2 and Python 3.

## Go

The Go implementation is located in `./jsone.go` and `./interpreter`.

Install dependencies:
```
GOPATH=$(pwd) go get -t ./...
```

To run the Go test run
```
GOPATH=$(pwd) go test -v -race ./...
```

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
Welcome to the team!

[participation]: https://www.mozilla.org/en-US/about/governance/policies/participation/
[issues]: ../../issues
[bugsahoy]: https://www.joshmatthews.net/bugsahoy/?taskcluster=1
[goodfirstbug]: http://www.joshmatthews.net/bugsahoy/?taskcluster=1&simple=1
[irc]: https://wiki.mozilla.org/IRC
[bestpractices]: https://docs.taskcluster.net/docs/manual/design/devel/best-practices
[testing]: https://docs.taskcluster.net/docs/manual/design/devel/best-practices/testing
[commit]: https://docs.taskcluster.net/docs/manual/design/devel/best-practices/commits


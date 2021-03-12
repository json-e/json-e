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

The JavaScript implementation is located in `./js`

You should run `yarn install` to install the required packages for JSON-e's execution and development.
To run the tests use `yarn test`

## Python

The Python implementation is located in `./py`.

To test this implementation, install and run `tox`, which will test on all supported Python versions.
If you have fewer Python versions installed, that's OK -- when you make a PR it will run for all versions.

## Go

The Go implementation is located in `internal/`, with a small stub in `jsone.go` in the root directory.
This follows the usual GoModules form, so running `go test ./...` in the root dir will run the tests.

## Rust

The Rust implementation is in `rs/`.
Within that directory, you will find a `Cargo.toml` and the usual Rust development tools apply: `cargo test`, `cargo build`, and so on.

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


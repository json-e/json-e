# Making a Release

* Run `towncrier --version=$newversion --draft` and check that the output looks OK.  Then run it without `--draft`, deleting the old newsfiles.  Commit.
* Update the version in:
  * `rs/Cargo.toml`
  * `js/package.json`
  * `py/setup.py`
* commit, and tag with `v$newversion`
* Push to release the JS version -- `git push && git push --tags`
* Release to PyPi:
  * `cd py/`
  * `python setup.py sdist`
  * `twine upload dist/json-e-<version>.tar.gz`
* Release to npm:
  * `npm publish` in `js/`
* Release to crates.io:
  * `cargo publish` in `rs/`
* Nothing to do for Go
* To deploy the web-site:
  * `deploy.sh`

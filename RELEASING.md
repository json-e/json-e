# Making a Release

* Run `towncrier --version=$newversion --draft` and check that the output looks OK.  Then run it without `--draft`, deleting the old newsfiles.  Commit.
* Update the version in:
  * `rs/Cargo.toml`
  * `js/package.json`
* commit, and tag with `v$newversion`
* Push to release the JS version -- `git push && git push --tags`
* Release to PyPi:
  * `python setup.py sdist`
  * `twine upload dist/json-e-<version>.tar.gz`
* Release to npm:
  * `npm publish` in `js/`
* Release to crates.io:
  * `cargo publish` in `rs/`
* Go doesn't believe in versions, so there's notihng to do for a Go release!
* To deploy the web-site:
  * `deploy.sh`

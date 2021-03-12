# Making a Release

* Run `towncrier --version=$newversion --draft` and check that the output looks OK.  Then run it without `--draft`, deleting the old newsfiles.  Commit.
* Update the version in:
  * `rs/Cargo.toml` and `rs/Cargo.lock`
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
  * `cd rs/`
  * `cp ../specification.yml .` - Cargo requires all necessary files to be in the directory, so temporarily include this file
  * `cargo publish --allow-dirty`
  * `rm specification.yml` - ..and remove the temporary file.  DO NOT CHECK IT IN!
* Nothing to do for Go
* To deploy the web-site:
  * `deploy.sh`

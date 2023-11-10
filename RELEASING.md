# Making a Release

Install towncrier<20, wheel and twine.

* Run `towncrier --version=$newversion --draft` and check that the output looks OK.  Then run it without `--draft`, deleting the old newsfiles.  Commit.
* Update the version in:
  * `rs/Cargo.toml` and `rs/Cargo.lock`
  * `js/package.json`
  * `py/setup.py`
* commit, and tag with `v$newversion`
* Release to PyPi:
  * `cd py/`
  * (if you haven't already installed it..) `pip install wheel`
  * `python setup.py sdist bdist_wheel`
  * `twine upload dist/json-e-<version>.{tar.gz,whl}`
* Release to npm:
  * `npm publish` in `js/`
* Release to crates.io:
  * `cd rs/`
  * `cp ../specification.yml .` - Cargo requires all necessary files to be in the directory, so temporarily include this file
  * `cargo publish --allow-dirty`
  * `rm specification.yml` - ..and remove the temporary file.  DO NOT CHECK IT IN!
* Nothing to do for Go
* Push -- `git push && git push --tags` (does this work?)
* Documentation:
  * Ensure you have `mdbook` installed (https://rust-lang.github.io/mdBook/guide/installation.html).
  * Ensure you have a node environment set up.
  * Ensure you have SSH access to push to the json-e/json-e repository.
  * Run `./deploy.sh`

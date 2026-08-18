# Making a Release

```bash
./release.sh <version>   # without the `v` prefix
```

`release.sh` prepares and pushes the release commit and tag; it does not
publish anything itself. Pushing the tag triggers
[`.github/workflows/release.yml`](.github/workflows/release.yml), which
publishes via Trusted Publishing (OIDC), with no credentials needed on your
machine, to:

- [crates.io](https://crates.io/crates/json-e)
- [npm](https://www.npmjs.com/package/json-e)
- [PyPI](https://pypi.org/project/json-e/)

and deploys the docs to <https://json-e.js.org>. Go needs no publish step:
the pushed tag *is* the release, resolved directly by `proxy.golang.org`.

**Never delete and re-create a `v*` tag.** `proxy.golang.org` caches
`module@version` immutably within minutes of the first fetch; retagging gives
every Go user who already fetched it a checksum-mismatch error with no way to
recover. If a release goes wrong, bump the patch version and release again.

## Integration audit

[Trusted Publishing](.github/workflows/release.yml) and the
[release](https://github.com/json-e/json-e/settings/environments/20101978916/edit)
environment are already configured.  This records what's live, for reference if
it ever needs auditing or redoing (e.g. after a rename).

All three registries bind trust to owner `json-e`, repo `json-e`, workflow
filename `release.yml`, environment `release`. Renaming any of those breaks
publishing to all three at once.

* [PyPI](https://pypi.org/manage/project/json-e/settings/publishing/)
* [npm](https://www.npmjs.com/package/json-e/access)
* [crates.io](https://crates.io/crates/json-e/settings)

GitHub `release` environment: deployment restricted to tags matching `v*`,
with a list of required reviewers configured on the environment itself
(Settings → Environments → release) rather than duplicated here, since a
name list here would drift as maintainers change.

GitHub tag ruleset "Releases" (`refs/tags/v*`): active, bypassable only by
repository admins. Blocks creating a `v*` tag, deleting one, and force-
pushing one to a different commit; that last case is what actually enforces
"never retag" at the git level, since a tag can otherwise be moved to point
at a new commit without ever being deleted first.

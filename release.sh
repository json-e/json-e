#!/bin/bash
#
# Cut a json-e release.
#
# This script does NOT publish anything. It prepares and pushes the release
# commit and annotated tag; pushing the tag triggers
# .github/workflows/release.yml, which publishes to crates.io, npm and PyPI
# via Trusted Publishing (OIDC) and then deploys the docs.

set -euo pipefail

version="${1:-}"
if [ -z "${version}" ] || [[ "${version}" == v* ]]; then
    echo 'USAGE: ./release.sh <version>   (without a leading "v", e.g. 4.8.3)' >&2
    exit 1
fi
if [[ ! "${version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "ERROR: '${version}' is not MAJOR.MINOR.PATCH." >&2
    echo "This release process does not support pre-release versions." >&2
    exit 1
fi

cd "$(dirname "${BASH_SOURCE[0]}")"

# The release target is fixed: push straight to this URL rather than via a
# locally-configured remote, whose name (or even existence) varies per
# maintainer (e.g. "origin" here is a personal fork, not json-e/json-e).
readonly TARGET_URL="git@github.com:json-e/json-e.git"

######################################################################
# Portable sed -i (macOS sed treats -i -e differently from GNU sed)
######################################################################
portable_sed() {
    if [[ "${OSTYPE}" == darwin* ]]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

######################################################################
# Echo "yes" / "no" / "error" for whether a registry already has this
# version. Never conflate "error" with "no": a network problem must not
# read as "not published". Returns via stdout rather than `exit`, since
# callers invoke this inside `$(...)`; exiting there would only kill the
# subshell, not the script, and get silently misread as an empty "no".
######################################################################
registry_has_version() {
    local name="$1" url="$2" code
    # curl's -w already prints "000" itself when no response was received
    # (DNS failure, timeout, connection refused, ...), so a `|| echo "000"`
    # fallback would double up and concatenate into "000000". The `||` here
    # is outside the substitution purely to stop `set -e` aborting the
    # whole script on a connection failure; code ends up "000" either way.
    code=$(curl -sS -o /dev/null -w '%{http_code}' \
           -H 'User-Agent: json-e-release-script (https://github.com/json-e/json-e)' \
           "${url}" 2>/dev/null) || code="000"
    case "${code}" in
        200) echo yes ;;
        404) echo no ;;
        *)   echo "ERROR: ${name} returned HTTP ${code} for ${url}" >&2
             echo error ;;
    esac
}

######################################################################
# Pre-flight checks: run ALL checks, report ALL failures at once
######################################################################
preflight() {
    local errors=()
    echo "=== Pre-flight checks ==="

    # Required binaries. Publishing tools (twine/npm/cargo/mdbook/yarn) are
    # no longer needed here; CI does the actual publishing.
    for bin in git towncrier curl jq; do
        command -v "${bin}" >/dev/null 2>&1 || errors+=("Missing binary: ${bin}")
    done
    if command -v towncrier >/dev/null 2>&1 && ! towncrier --version >/dev/null 2>&1; then
        errors+=("towncrier is installed but not working")
    fi

    # Release target reachable?
    echo "  Release target: ${TARGET_URL}"
    if ! git ls-remote "${TARGET_URL}" >/dev/null 2>&1; then
        errors+=("'${TARGET_URL}' is not reachable (check SSH keys / network)")
    fi

    # Repo state: on main branch
    local branch
    branch=$(git rev-parse --abbrev-ref HEAD)
    if [ "${branch}" != "main" ]; then
        errors+=("Not on main branch (currently on '${branch}'). To fix: git checkout main")
    fi

    # Repo state: clean working tree
    if [ -n "$(git status --porcelain)" ]; then
        errors+=("Working tree is not clean; see details below")
    fi

    # Repo state: local main must match upstream main
    local local_head="" remote_head=""
    if [ "${branch}" == "main" ]; then
        local_head=$(git rev-parse HEAD)
        remote_head=$(git ls-remote "${TARGET_URL}" refs/heads/main 2>/dev/null | cut -f1)
        if [ -n "${remote_head}" ] && [ "${local_head}" != "${remote_head}" ]; then
            errors+=("Local main (${local_head}) differs from ${TARGET_URL}'s main (${remote_head}). Run: git pull --ff-only ${TARGET_URL} main")
        fi
    fi

    # The release workflow must exist at the commit being tagged, or the
    # tag push publishes nothing.
    if [ ! -f .github/workflows/release.yml ]; then
        errors+=(".github/workflows/release.yml is missing at HEAD: the tag would publish nothing")
    fi

    # Upstream main must be green before we release it. Taskcluster
    # reports check-runs (reporting: checks-v1 in .taskcluster.yml), not
    # legacy commit statuses, so query check-runs and ignore this
    # workflow's own check (it hasn't run yet at this point anyway).
    #
    # A failed fetch (GitHub outage, network blip) must be a hard error,
    # not silently read as "no check runs, therefore green"; check the
    # HTTP status explicitly rather than falling back to an empty `{}`.
    if [ -n "${remote_head}" ] && command -v curl >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
        local checks_url checks_code checks non_success
        checks_url="https://api.github.com/repos/json-e/json-e/commits/${remote_head}/check-runs?per_page=100"
        checks_code=$(curl -sS -o /dev/null -w '%{http_code}' -H 'Accept: application/vnd.github+json' "${checks_url}" 2>/dev/null) || checks_code="000"
        if [ "${checks_code}" != "200" ]; then
            errors+=("Could not fetch GitHub check-runs for ${remote_head} (HTTP ${checks_code}); cannot confirm upstream main is green")
        else
            checks=$(curl -sS -H 'Accept: application/vnd.github+json' "${checks_url}")
            non_success=$(echo "${checks}" | jq -r '
                [.check_runs[]? | select(.app.slug != "github-actions")
                    | select(.status != "completed" or (.conclusion != "success" and .conclusion != "neutral" and .conclusion != "skipped"))
                    | "\(.name): \(.status)/\(.conclusion // "-")"] | .[]')
            if [ -n "${non_success}" ]; then
                errors+=("Upstream main (${remote_head}) is not green:")
                while IFS= read -r line; do
                    errors+=("    ${line}")
                done <<< "${non_success}"
            fi
        fi
    fi

    # Version sanity: strictly greater than the current version
    local current
    current=$(sed -n 's/^version = "\(.*\)"$/\1/p' py/setup.py | head -1)
    if [ "${version}" == "${current}" ]; then
        errors+=("Version ${version} is already the current version")
    elif [ "$(printf '%s\n%s\n' "${current}" "${version}" | sort -V | tail -1)" != "${version}" ]; then
        errors+=("Version ${version} is lower than the current version ${current}")
    fi

    # Tag doesn't already exist (locally or on remote)
    if git rev-parse "v${version}" >/dev/null 2>&1; then
        errors+=("Tag v${version} already exists locally")
    fi
    local remote_tag
    remote_tag=$(git ls-remote --tags "${TARGET_URL}" "refs/tags/v${version}" 2>/dev/null | cut -f1)
    if [ -n "${remote_tag}" ]; then
        errors+=("Tag v${version} already exists on ${TARGET_URL}")
    fi

    # Version not already published to registries. This is the last cheap
    # check before the tag becomes public and effectively permanent (Go's
    # module proxy caches tags immutably within minutes of first fetch).
    local npm_status pypi_status crates_status
    npm_status=$(registry_has_version npm "https://registry.npmjs.org/json-e/${version}")
    pypi_status=$(registry_has_version PyPI "https://pypi.org/pypi/json-e/${version}/json")
    crates_status=$(registry_has_version crates.io "https://crates.io/api/v1/crates/json-e/${version}")

    case "${npm_status}" in
        yes)   errors+=("Version ${version} already published on npm") ;;
        error) errors+=("Could not determine whether ${version} is already published on npm; see stderr above") ;;
    esac
    case "${pypi_status}" in
        yes)   errors+=("Version ${version} already published on PyPI") ;;
        error) errors+=("Could not determine whether ${version} is already published on PyPI; see stderr above") ;;
    esac
    case "${crates_status}" in
        yes)   errors+=("Version ${version} already published on crates.io") ;;
        error) errors+=("Could not determine whether ${version} is already published on crates.io; see stderr above") ;;
    esac

    # Report
    if [ ${#errors[@]} -gt 0 ]; then
        echo ""
        echo "Pre-flight FAILED with ${#errors[@]} error(s):"
        for err in "${errors[@]}"; do
            echo "  - ${err}"
        done

        if [ -n "$(git status --porcelain)" ]; then
            echo ""
            echo "Working tree status:"
            git status --short
            echo ""
            echo "To inspect changes before discarding:"
            echo "  git diff                   # staged and unstaged changes to tracked files"
            echo "  git diff --cached          # staged changes only"
            echo "  git status                 # full status including untracked files"
            echo ""
            echo "To discard ALL local changes (WARNING: this is irreversible):"
            echo "  git checkout main          # switch to main branch"
            echo "  git reset --hard HEAD      # discard all changes to tracked files"
            echo "  git clean -fd              # delete untracked files and directories"
        fi

        echo ""
        exit 1
    fi

    echo "  All pre-flight checks passed."
    echo ""
}

######################################################################
# Release steps
######################################################################

update_changelog() {
    local cl_version
    cl_version=$(head -n 1 CHANGELOG.rst | cut -d' ' -f 2)
    if [ "${cl_version}" == "${version}" ]; then
        echo "=== CHANGELOG.rst already at ${version}, skipping towncrier"
        return
    fi
    echo "=== Changelog draft"
    towncrier build --version="${version}" --draft
    read -r -p "Look OK? (ctrl-c if not, enter if OK) "
    towncrier build --version="${version}" --yes   # stages CHANGELOG.rst, removes fragments
}

update_versions() {
    echo "=== Bumping version strings to ${version}"
    portable_sed "s/^version = \"[0-9.]*\"/version = \"${version}\"/" rs/Cargo.toml
    portable_sed "s/\"version\": \"[0-9.]*\"/\"version\": \"${version}\"/" js/package.json
    portable_sed "s/^version = \"[0-9.]*\"/version = \"${version}\"/" py/setup.py

    # Bump only the json-e stanza of Cargo.lock. Deliberately not `cargo
    # build`: that needs a local Rust toolchain (which this script no
    # longer otherwise requires) and can pull unrelated dependency updates
    # into a commit that should be five version strings. CI's
    # `cargo publish --dry-run` is what actually enforces correctness.
    awk -v ver="${version}" '
        /^\[\[package\]\]/      { in_pkg = 0 }
        /^name = "json-e"$/     { in_pkg = 1 }
        in_pkg && /^version = / { print "version = \"" ver "\""; in_pkg = 0; next }
                                { print }
    ' rs/Cargo.lock > rs/Cargo.lock.new
    mv rs/Cargo.lock.new rs/Cargo.lock

    git add rs/Cargo.toml rs/Cargo.lock js/package.json py/setup.py
}

verify_versions() {
    echo "=== Verifying versions agree"
    ./scripts/check-versions.sh "${version}"
}

commit_and_tag() {
    echo
    echo "=== Release commit contents"
    git diff --cached --stat
    echo
    read -r -p "Commit and tag v${version}? (ctrl-c if not, enter if OK) "
    git commit -m "v${version}"
    git tag -a "v${version}" -m "v${version}"
}

push_release() {
    echo "=== Pushing to ${TARGET_URL}"
    git push --atomic "${TARGET_URL}" main:main "refs/tags/v${version}"
    echo
    echo "Pushed v${version}."
    echo "CI now publishes to crates.io, npm and PyPI, then deploys the docs:"
    echo
    echo "  https://github.com/json-e/json-e/actions/workflows/release.yml"
    echo
    echo "The publish jobs wait for approval on the 'release' environment."

    if command -v gh >/dev/null 2>&1; then
        echo
        echo "Watching the run (ctrl-c stops watching; the run itself keeps going)..."
        sleep 10
        local run_id=""
        run_id=$(gh run list --repo json-e/json-e --workflow=release.yml --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null) || true
        if [ -n "${run_id}" ]; then
            gh run watch --repo json-e/json-e --exit-status "${run_id}" \
                || echo "Release workflow did not succeed"
        else
            echo "Could not find the release workflow run to watch; check the Actions tab."
        fi
    fi
}

######################################################################
# Main
######################################################################

preflight
update_changelog
update_versions
verify_versions
commit_and_tag
push_release

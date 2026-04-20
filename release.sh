#!/bin/bash

set -e

version="${1}"
if [ -z "${version}" ] || [[ "${version}" == v* ]]; then
    echo 'USAGE: ./release.sh <version>  (without `v` prefix)'
    exit 1
fi

######################################################################
# Portable sed -i (macOS sed treats -i -e differently from GNU sed)
######################################################################
portable_sed() {
    if [[ "$OSTYPE" == darwin* ]]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

######################################################################
# Detect which git remote points to json-e/json-e
######################################################################
detect_remote() {
    local remote
    for remote in $(git remote); do
        local url
        url=$(git remote get-url "$remote" 2>/dev/null || true)
        if [[ "$url" == *"github.com"*"json-e/json-e"* ]]; then
            echo "$remote"
            return
        fi
    done
    return 1
}

######################################################################
# Pre-flight checks — run ALL checks, report ALL failures at once
######################################################################
preflight() {
    local errors=()

    echo "=== Pre-flight checks ==="

    # Required binaries
    for bin in git towncrier twine python npm cargo mdbook yarn; do
        if ! command -v "$bin" >/dev/null 2>&1; then
            errors+=("Missing binary: $bin")
        fi
    done

    # Python version >= 3.10
    if command -v python >/dev/null 2>&1; then
        local pyver
        pyver=$(python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        local pymajor=${pyver%%.*}
        local pyminor=${pyver##*.}
        if [ "$pymajor" -lt 3 ] || { [ "$pymajor" -eq 3 ] && [ "$pyminor" -lt 10 ]; }; then
            errors+=("Python >= 3.10 required (found $pyver)")
        fi
    fi

    # Python packages
    if command -v python >/dev/null 2>&1; then
        if ! python -m build --help >/dev/null 2>&1; then
            errors+=("Python 'build' package not installed (pip install build)")
        fi
    fi
    if command -v towncrier >/dev/null 2>&1; then
        if ! towncrier --version >/dev/null 2>&1; then
            errors+=("towncrier not working")
        fi
    fi
    if command -v twine >/dev/null 2>&1; then
        if ! twine --version >/dev/null 2>&1; then
            errors+=("twine not working")
        fi
    fi

    # npm auth
    if command -v npm >/dev/null 2>&1; then
        local npm_user
        npm_user=$(npm whoami 2>/dev/null) || true
        if [ -n "$npm_user" ]; then
            echo "  npm: authenticated as $npm_user"
        else
            errors+=("npm not authenticated (run: npm login)")
        fi
    fi

    # cargo / crates.io auth
    if command -v cargo >/dev/null 2>&1; then
        if [ -n "${CARGO_REGISTRY_TOKEN:-}" ]; then
            echo "  crates.io: authenticated via CARGO_REGISTRY_TOKEN env var"
        elif [ -f "$HOME/.cargo/credentials.toml" ]; then
            echo "  crates.io: authenticated via ~/.cargo/credentials.toml"
        elif [ -f "$HOME/.cargo/credentials" ]; then
            echo "  crates.io: authenticated via ~/.cargo/credentials"
        else
            errors+=("crates.io not authenticated (run: cargo login)")
        fi
    fi

    # PyPI auth
    if [ -n "${TWINE_USERNAME:-}" ]; then
        echo "  PyPI: authenticated as $TWINE_USERNAME (via env var)"
    elif [ -f "$HOME/.pypirc" ]; then
        local pypi_user
        pypi_user=$(grep -A5 '\[pypi\]' "$HOME/.pypirc" 2>/dev/null | grep 'username' | head -1 | sed 's/.*=\s*//' || true)
        if [ -n "$pypi_user" ]; then
            echo "  PyPI: authenticated as $pypi_user (via ~/.pypirc)"
        else
            echo "  PyPI: authenticated via ~/.pypirc"
        fi
    else
        errors+=("PyPI not authenticated (create ~/.pypirc or set TWINE_USERNAME/TWINE_PASSWORD)")
    fi

    # Git remote
    REMOTE=$(detect_remote) || true
    if [ -z "${REMOTE:-}" ]; then
        errors+=("No git remote pointing to github.com:json-e/json-e found")
    else
        echo "  Using git remote: $REMOTE"
        if ! git ls-remote "$REMOTE" >/dev/null 2>&1; then
            errors+=("Git remote '$REMOTE' is not reachable (check SSH keys / network)")
        fi
    fi

    # Repo state: on main branch
    local branch
    branch=$(git rev-parse --abbrev-ref HEAD)
    if [ "$branch" != "main" ]; then
        errors+=("Not on main branch (currently on '$branch'). To fix: git checkout main")
    fi

    # Repo state: clean working tree
    if [ -n "$(git status --porcelain)" ]; then
        errors+=("Working tree is not clean — see details below")
    fi

    # Repo state: local main must match upstream main
    if [ -n "${REMOTE:-}" ] && [ "$branch" == "main" ]; then
        local local_head remote_head
        local_head=$(git rev-parse HEAD)
        remote_head=$(git ls-remote "$REMOTE" refs/heads/main 2>/dev/null | cut -f1)
        if [ -n "$remote_head" ] && [ "$local_head" != "$remote_head" ]; then
            errors+=("Local main ($local_head) differs from $REMOTE/main ($remote_head). Run: git pull --ff-only $REMOTE main")
        fi
    fi

    # Tag doesn't already exist (locally or on remote)
    if git rev-parse "v${version}" >/dev/null 2>&1; then
        errors+=("Tag v${version} already exists locally")
    fi
    if [ -n "${REMOTE:-}" ]; then
        local remote_tag
        remote_tag=$(git ls-remote --tags "$REMOTE" "refs/tags/v${version}" 2>/dev/null | cut -f1)
        if [ -n "$remote_tag" ]; then
            errors+=("Tag v${version} already exists on remote '$REMOTE'")
        fi
    fi

    # Package not already published to registries
    if command -v curl >/dev/null 2>&1; then
        if curl -sf "https://registry.npmjs.org/json-e/${version}" >/dev/null 2>&1; then
            errors+=("Version ${version} already published on npm")
        fi
        if curl -sf "https://pypi.org/pypi/json-e/${version}/json" >/dev/null 2>&1; then
            errors+=("Version ${version} already published on PyPI")
        fi
        if curl -sf "https://crates.io/api/v1/crates/json-e/${version}" >/dev/null 2>&1; then
            errors+=("Version ${version} already published on crates.io")
        fi
    fi

    # Report
    if [ ${#errors[@]} -gt 0 ]; then
        echo ""
        echo "Pre-flight FAILED with ${#errors[@]} error(s):"
        for err in "${errors[@]}"; do
            echo "  - $err"
        done

        # Show working tree details if dirty
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
        return
    fi
    towncrier build --version="$version" --draft
    read -p "Look OK? (ctrl-c if not, enter if OK)"
    towncrier build --version="$version" --yes
}

update_version_rs() {
    portable_sed "s/^version = \"[0-9.]*\"/version = \"$version\"/" rs/Cargo.toml
    ( cd rs && cargo build )
    git add rs/Cargo.toml rs/Cargo.lock
}

update_version_js() {
    portable_sed "s/\"version\": \"[0-9.]*\"/\"version\": \"$version\"/" js/package.json
    git add js/package.json
}

update_version_py() {
    portable_sed "s/^version = \"[0-9.]*\"/version = \"$version\"/" py/setup.py
    git add py/setup.py
}

commit_and_tag() {
    git commit -m "v$version"
    git tag "v$version"
}

upload_rs() {
    cd rs
    cp ../specification.yml .
    cargo publish --allow-dirty
    rm specification.yml
    cd ..
}

upload_js() {
    cd js
    yarn install
    npm publish
    cd ..
}

upload_py() {
    cd py
    rm -rf dist/*
    python -m build
    twine upload dist/*
    cd ..
}

push_git() {
    git push "$REMOTE" main:main
    git push "$REMOTE" --follow-tags "v$version"
}

######################################################################
# Main
######################################################################

preflight

# Update the repo contents and commit
update_changelog
update_version_rs
update_version_js
update_version_py
commit_and_tag

# Upload various packages
upload_rs
upload_js
upload_py
push_git
./deploy-docs.sh

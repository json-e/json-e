#! /bin/bash

set -e

version="${1}"
if [ -z "${version}" ] || [[ "${version}" == v* ]]; then
    echo 'USAGE: ./release.sh <version>  (without `v` prefix)'
    exit 1
fi

check_binaries() {
    for bin in git towncrier twine python npm cargo mdbook; do
        if ! which ${bin} >/dev/null; then
            echo "Install ${bin} first."
            exit 1
        fi
    done
}

check_tag() {
    if git rev-parse "v${version}" 2>/dev/null >/dev/null; then
        echo "Version ${version} is already tagged."
        exit 1
    fi
}

update_changelog() {
    local cl_version=$(head -n 1 CHANGELOG.rst | cut -d' ' -f 2)
    if [ "${cl_version}" == "${version}" ]; then
        return
    fi
    towncrier --version=$version --draft
    read -p "Look OK? (ctrl-c if not, enter if OK)"
    towncrier --version=$version --yes
}

update_version_rs() {
    sed -i -e "s/^version = \"[0-9.]*\"/version = \"$version\"/" rs/Cargo.toml
    ( cd rs; cargo build )
    git add rs/Cargo.{toml,lock}
}

update_version_js() {
    sed -i -e "s/\"version\": \"[0-9.]*\"/\"version\": \"$version\"/" js/package.json
    git add js/package.json
}

update_version_py() {
    sed -i -e "s/^version = \"[0-9.]*\"/version = \"$version\"/" py/setup.py
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
    npm publish
    cd ..
}

upload_py() {
    cd py
    rm -rf dist/*
    python setup.py sdist bdist_wheel
    twine upload dist/*
    cd ..
}

push_git() {
    git push upstream main:main --follow-tags
}

# Check stuff
check_tag
check_binaries

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

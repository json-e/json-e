#!/bin/bash

set -o errexit -o nounset

TARGET_BRANCH="gh-pages"
BUILD_DIR="book"
SHA=`git rev-parse --short HEAD`

echo === rebuilding deps
(
    cd docs/deps
    yarn
    ./node_modules/.bin/webpack-cli --mode production
)

echo === building book
mdbook build

echo === uploading
(
    cd $BUILD_DIR
    git init
    git config user.name "Taskcluster Github"
    git config user.email "taskcluster-notifications+jsone-demo@mozilla.com"

    git remote add upstream "git@github.com:json-e/json-e.git"
    git fetch upstream
    git reset "upstream/$TARGET_BRANCH"

    git add -A .
    git commit --allow-empty -m "Rebuilding $TARGET_BRANCH from $SHA"
    git push -q upstream "HEAD:$TARGET_BRANCH"
)

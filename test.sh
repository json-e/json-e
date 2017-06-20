#!/bin/sh -xe

# This script runs the unit tests for both the JavaScript and the Python
# implementations of json-e. It also updated the demo website with the new
# bundle.js file.

# JavaScript unit tests
npm test

# Python unit tests
python setup.py test

# docs site check. ensures that you've updated the docs before pushing
yarn build-demo
if [[ -z $(git status --porcelain -- ./docs) ]]; then
  exit 0
else
  echo "The docs site needs to be checked in!"
  exit 1
fi


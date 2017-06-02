#!/bin/sh -xe

# This script runs the unit tests for both the JavaScript and the Python
# implementations of json-e. It also updated the demo website with the new
# bundle.js file.

# JavaScript unit tests
npm test

# Python unit tests
python setup.py test

# bundle.js check. Note that the new bundle.js is not deleted
mv docs/bundle.js docs/bundle.diff.js
npm run-script build-demo
diff docs/bundle.js docs/bundle.diff.js

rm docs/bundle.diff.js

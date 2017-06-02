#!/bin/sh -xe

# This script runs the unit tests for both the JavaScript and the Python
# implementations of json-e. It also updated the demo website with the new
# bundle.js file.

npm test && python setup.py test && npm run-script build-demo

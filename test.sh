#!/bin/sh -xe

# This script runs the unit tests for both the JavaScript and the Python
# implementations of json-e.

# JavaScript unit tests
npm test

# Python unit tests
python setup.py test

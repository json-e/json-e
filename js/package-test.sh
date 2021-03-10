#! /bin/bash

set -e

orig_dir=`pwd`
tmpdir=`mktemp -d`
trap "{ rm -rf $tmpdir; }" EXIT
cd $tmpdir
npm pack $orig_dir
npm init -y
npm install json-e-*.tgz
node -e 'console.log(require("json-e")({"success": true}, {}))'

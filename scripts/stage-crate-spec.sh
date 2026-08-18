#!/bin/bash
#
# rs/build.rs reads ../specification.yml, falling back to ./specification.yml
# so that a crate unpacked from crates.io (which has no sibling directory)
# still builds. rs/Cargo.toml has no include/exclude, so the file must
# physically exist under rs/ to be packaged, which is why `cargo publish`
# always needs --allow-dirty here. This script only ever runs on a fresh
# CI checkout, so that's the sole source of dirtiness it needs to permit.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

cp specification.yml rs/specification.yml

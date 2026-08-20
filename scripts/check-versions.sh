#!/bin/bash
#
# Assert that every place that records the json-e version agrees with the
# version given. Run both locally by release.sh (right after bumping, before
# committing) and in CI by the release workflow's `verify` job, so local and
# remote can never drift apart.
#
# Deliberately uses only sed/awk/grep/find, no python, node, cargo or jq,
# so it works identically on a bare release runner and on a laptop.

set -euo pipefail

version="${1:-}"
if [ -z "${version}" ]; then
    echo "usage: $0 <version>   (without the 'v' prefix)" >&2
    exit 2
fi

cd "$(dirname "${BASH_SOURCE[0]}")/.."

fail=0

check() {
    local what="$1" got="$2"
    if [ "${got}" != "${version}" ]; then
        printf '  MISMATCH  %-16s expected %-12s found %s\n' "${what}" "${version}" "${got:-<none>}"
        fail=1
    else
        printf '  ok        %-16s %s\n' "${what}" "${got}"
    fi
}

echo "Checking all version strings are ${version}:"

check "rs/Cargo.toml"   "$(sed -n 's/^version = "\(.*\)"$/\1/p' rs/Cargo.toml | head -1)"
check "js/package.json" "$(sed -n 's/^  "version": "\(.*\)",$/\1/p' js/package.json | head -1)"
check "py/setup.py"     "$(sed -n 's/^version = "\(.*\)"$/\1/p' py/setup.py | head -1)"

# The json-e stanza of Cargo.lock: `name` always precedes `version` within
# a [[package]] block.
check "rs/Cargo.lock" "$(awk '
    /^\[\[package\]\]/  { in_pkg = 0 }
    /^name = "json-e"$/ { in_pkg = 1; next }
    in_pkg && /^version = / {
        gsub(/(^version = "|"$)/, "")
        print
        exit
    }
' rs/Cargo.lock)"

# Go modules with a major version >= 2 must have the version suffix in the
# module path (Go's semantic import versioning). This has to be caught here,
# not only in CI: Go has no separate publish step, the tag itself IS the
# release, resolved directly by proxy.golang.org before CI even starts; by
# the time a CI-only check could catch a mismatch, it's already too late.
major="${version%%.*}"
modpath="$(sed -n 's/^module[[:space:]][[:space:]]*//p' go.mod)"
if [ "${major}" -ge 2 ]; then
    want="/v${major}"
    case "${modpath}" in
        *"${want}") printf '  ok        %-16s %s\n' "go.mod" "${modpath}" ;;
        *)          echo "  MISMATCH  go.mod           '${modpath}' does not end in '${want}'"
                    fail=1 ;;
    esac
else
    printf '  ok        %-16s %s (no /vN suffix required below v2)\n' "go.mod" "${modpath}"
fi

# CHANGELOG heading shape: `# Jsone X.Y.Z (YYYY-MM-DD)`
cl_first_line="$(head -n1 CHANGELOG.md)"
if echo "${cl_first_line}" | grep -Eq "^# Jsone ${version//./\\.} \([0-9]{4}-[0-9]{2}-[0-9]{2}\)\$"; then
    printf '  ok        %-16s %s\n' "CHANGELOG.md" "${version}"
else
    printf '  MISMATCH  %-16s expected first line '"'"'# Jsone %s (YYYY-MM-DD)'"'"', found: %s\n' \
        "CHANGELOG.md" "${version}" "${cl_first_line}"
    fail=1
fi

# Leftover news fragments mean `towncrier build` never ran, i.e. someone
# hand-edited the version strings or tagged without running release.sh.
leftover="$(find py/jsone/newsfragments -type f ! -name '.gitignore' -print 2>/dev/null || true)"
if [ -n "${leftover}" ]; then
    echo "  MISMATCH  newsfragments    unconsumed fragments present:"
    # Intentionally unquoted: word-splits on the newline-separated file
    # list so printf recycles the format and prints one path per line.
    # shellcheck disable=SC2086
    printf '                             %s\n' ${leftover}
    fail=1
else
    printf '  ok        %-16s no unconsumed fragments\n' "newsfragments"
fi

if [ "${fail}" -ne 0 ]; then
    echo
    echo "Version consistency check FAILED." >&2
    exit 1
fi
echo "All version strings agree."

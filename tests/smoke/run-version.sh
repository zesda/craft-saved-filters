#!/usr/bin/env bash
# Runs craft-internals.mjs against a released craftcms/cms version.
#
# Usage: tests/smoke/run-version.sh 5.12.0
set -euo pipefail

version="${1:?Usage: run-version.sh <craftcms/cms version>}"
here="$(cd "$(dirname "$0")" && pwd)"
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT

curl -fsSL "https://github.com/craftcms/cms/archive/refs/tags/${version}.tar.gz" \
  | tar -xz -C "$dir" --strip-components=1 \
      --include='*/src/web/assets/cp/dist/cp.js.map' \
      --include='*/src/web/assets/garnish/dist/garnish.js.map' \
      --include='*/src/templates/_layouts/elementindex.twig'

node "$here/craft-internals.mjs" "$dir"

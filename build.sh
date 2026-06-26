#!/usr/bin/env bash

set -euo pipefail

function main() {
  case "${1:-}" in
  "")
    cd "$(dirname "$0")"
    node scripts/build.mjs
    ;;
  -h | --help)
    usage
    ;;
  *)
    die "Unknown option: $1"
    ;;
  esac
}

usage() {
  cat <<EOF
Usage: $(basename "$0")

Build dist/lobe-icons.ttf from @lobehub/icons-static-svg.
EOF
}

die() {
  echo "Error: $1" >&2
  exit "${2:-1}"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi

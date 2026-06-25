#!/usr/bin/env bash
# Build dist/ai-icons.ttf from lobehub icons.
#   svgs -> fantasticon (ttf) -> format-12 cmap rewrite + stable codepoint pin
set -euo pipefail
cd "$(dirname "$0")"

npm install --silent
node scripts/collect.mjs

# A few icons use multi-subpath / fill-opacity / even-odd constructs that
# fantasticon's tracer silently drops. picosvg resolves them. Only these are
# normalized: running picosvg over every icon trips a Node-stream bug in the
# tracer, so keep the blast radius to the known offenders.
for name in cohere dreammachine hermesagent huawei; do
  f="svg/$name.svg"
  [ -f "$f" ] && picosvg "$f" > "$f.tmp" && mv "$f.tmp" "$f"
done

mkdir -p dist
npx fantasticon
python3 scripts/remap.py

echo "done: dist/lobe-icons.ttf"

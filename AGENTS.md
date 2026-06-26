# Agent Notes

Build pipeline for a glyph font of LobeHub AI provider icons.

- `npm run build` runs `scripts/build.mjs`, a Node-only pipeline:
  extract monochrome icon paths from `@lobehub/icons` -> assign stable
  codepoints -> generate TTF.
- `npm run check` snapshots `codepoints.json` and `dist/lobe-icons.ttf`, rebuilds,
  and fails if either generated file changes.
- `codepoints.json` is the source of truth and must stay stable: never reassign
  an existing icon's codepoint. New icons append. Removed icons keep their slot.
- Block is `U+F4000-U+F47FF`. Do not move it (would collide with Nerd Fonts or
  break hardcoded glyphs).
- The generated font must include UCS-4/format-12 cmap subtables because icons
  live above `U+FFFF`.

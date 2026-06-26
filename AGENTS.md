# Agent Notes

Build pipeline for a glyph font of lobehub AI provider icons.

- `npm run build` runs `scripts/build.mjs`, a Node-only pipeline:
  collect monochrome SVGs -> assign stable codepoints -> generate TTF.
- `codepoints.json` is the source of truth and must stay stable: never reassign
  an existing icon's codepoint. New icons append; removed icons keep their slot.
- Block is `U+F4000-U+F47FF`. Do not move it (would collide with Nerd Fonts or
  break hardcoded glyphs).
- The generated font must include UCS-4/format-12 cmap subtables because icons
  live above `U+FFFF`.

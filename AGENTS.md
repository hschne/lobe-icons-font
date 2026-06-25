# Agent Notes

Build pipeline for a glyph font of lobehub AI provider icons.

- `build.sh` orchestrates: `collect.mjs` (copy monochrome svgs) -> picosvg
  (normalize the few that fantasticon drops) -> fantasticon (ttf) -> `remap.py`
  (stable codepoint pin + format-12 cmap rewrite).
- `codepoints.json` is the source of truth and must stay stable: never reassign
  an existing icon's codepoint. New icons append; removed icons keep their slot.
- Block is `U+F4000-U+F47FF`. Do not move it (would collide with Nerd Fonts or
  break hardcoded glyphs).
- fantasticon writes a BMP-only cmap; the format-12 rewrite in `remap.py` is
  required, not optional.

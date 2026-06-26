# lobe-icons-font

A glyph font of [lobehub](https://github.com/lobehub/lobe-icons) AI/LLM provider
logos (Claude, OpenAI, Gemini, DeepSeek, Mistral, ...) for terminals and waybar.
Print a codepoint, get the logo.

lobe-icons ships SVG/React, not a font. This repo builds the font from those SVGs
and pins each provider to a stable codepoint.

## Codepoints

Glyphs live in Plane 15 at `U+F4000-U+F47FF` (2048-slot reserved block). That
sits well above Nerd Fonts' Material Design block (`U+F0001-U+F1AF0`), so the two
coexist with no collisions. 309 icons currently occupy `U+F4000-U+F4134`.

`codepoints.json` is the source of truth: name to codepoint. It is **stable** -
an icon keeps its codepoint forever, new icons append to the next free slot,
removed icons keep their slot reserved. Hardcode a glyph in a config and it stays
valid across rebuilds.

## Build

Needs Node.js only.

```bash
npm ci
npm run build
```

Output is `dist/lobe-icons.ttf`. Re-run after updating `@lobehub/icons-static-svg`
to pull new logos.

The build is a single JS pipeline:

1. copy monochrome base SVGs into `svg/`
2. assign stable codepoints from `codepoints.json`
3. generate a UCS-4/format-12 TTF at `dist/lobe-icons.ttf`

## Release

Use the manual GitHub Action:

1. open **Actions -> Release icons**
2. run the workflow with a tag like `v0.1.0`
3. download `lobe-icons.ttf`, `codepoints.json`, or the release tarball from the GitHub release

## Install

```bash
cp dist/lobe-icons.ttf ~/.local/share/fonts/
fc-cache -f
```

Family name is `lobe-icons`.

## Use

Look up a codepoint in `codepoints.json`, then emit it. Anything that prints the
character renders the logo, as long as the renderer does per-glyph font fallback.

**waybar** - Pango falls back automatically; add the font to the stack:

```css
* {
  font-family: "Your Nerd Font", "lobe-icons", sans-serif;
}
```

```bash
printf '\U000F4036'   # claude
printf '\U000F40D0'   # openai
```

**Terminals** - point the range at the font:

```ini
# kitty
symbol_map U+F4000-U+F47FF lobe-icons
# ghostty
font-codepoint-map = U+F4000-U+F47FF=lobe-icons
# foot
font=Your Mono:size=11, lobe-icons:size=11
```

Alacritty has no per-glyph fallback and is not supported.

## Notes

- Only the monochrome `name.svg` icons are built. A font glyph is single-color,
  so the `-color` and `-text` variants are skipped.
- lobe-icons notes the logos may be copyright-protected. Fine for personal use,
  check before redistributing.

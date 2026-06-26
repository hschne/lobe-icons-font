# lobe-icons-font

A glyph font of [LobeHub](https://github.com/lobehub/lobe-icons) AI/LLM
provider logos for terminals and waybar. Print a codepoint, get the logo.

The source package is `@lobehub/icons`. This repo extracts the monochrome React
icon paths and builds a TrueType font.

## Codepoints

Glyphs live in Plane 15 at `U+F4000-U+F47FF` (2048 slots). That sits above Nerd
Fonts' Material Design block (`U+F0001-U+F1AF0`), so the two coexist without
collisions. 309 icons currently occupy `U+F4000-U+F4134`.

`codepoints.json` is the source of truth. Existing icons keep their codepoint.
New icons append to the next free slot. Removed icons keep their slot reserved.

## Build

```bash
mise run build
# or
npm run build
```

The build is one Node script:

1. collect monochrome icons from `@lobehub/icons/es/*/components/Mono.js`
2. fall back to `Color.js` only when Mono wraps the color icon in grayscale
3. assign stable codepoints from `codepoints.json`
4. generate `dist/lobe-icons.ttf`
5. assert format-12 cmap mappings and clipping-safe vertical metrics

## Check

```bash
mise run check
# or
npm run check
```

`check` snapshots the current generated files, rebuilds, and compares the result.
If `codepoints.json` or `dist/lobe-icons.ttf` changes during the rebuild, check
fails.

## Release

The package version mirrors `@lobehub/icons`. To release:

1. update `@lobehub/icons` and this package version together
2. run `npm run check`
3. commit changed files
4. run the manual **Release icons** GitHub Action

The workflow creates tag `v<package version>` and uploads the font, codepoint
map, and tarball. `codepoints.json` is shipped because users need it to look up
glyphs.

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

- Font glyphs are single-color. Color/text variants are not built.
- LobeHub notes that logos may be copyright-protected. Fine for personal use;
  check before redistributing.

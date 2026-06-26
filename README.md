<div align="center">

# Lobe Icons Font

A glyph font of **309 monochrome AI / LLM provider logos** for terminals,
status bars, and the web. Print a codepoint, get the logo.

[Browse the icons](https://hschne.github.io/lobe-icons-font/) ·
[Source icons by LobeHub](https://github.com/lobehub/lobe-icons)

<img src="docs/assets/preview.png" alt="All 309 Lobe Icons Font glyphs, each shown next to its name" width="100%" />

</div>

## What it is

[`@lobehub/icons`](https://github.com/lobehub/lobe-icons) ships hundreds of AI
and LLM brand logos as React components. This repo extracts the monochrome icon
paths and bakes them into a single TrueType font, so any renderer with per-glyph
font fallback can show a logo just by printing a character.

- **Mono only** — one color, follows `currentColor`. No color or text variants.
- **Stable codepoints** — `codepoints.json` is the source of truth; an icon never
  changes its slot.
- **Coexists with Nerd Fonts** — glyphs live in Plane 15 at `U+F4000–U+F47FF`,
  clear of Nerd Fonts' blocks.

## Install

Download `lobe-icons.ttf` from the
[latest release](https://github.com/hschne/lobe-icons-font/releases/latest),
then install it:

```bash
# Linux
curl -L -o lobe-icons.ttf \
  https://github.com/hschne/lobe-icons-font/releases/latest/download/lobe-icons.ttf
mkdir -p ~/.local/share/fonts
mv lobe-icons.ttf ~/.local/share/fonts/
fc-cache -f
```

On macOS, double-click the downloaded `lobe-icons.ttf` and click _Install Font_.
The font family name is `lobe-icons`.

Prefer to build it yourself? See [Development](#development).

## Use

Look up a slug in `codepoints.json`, then print its codepoint. Anything that
renders the character shows the logo, provided the renderer does per-glyph font
fallback.

**Status bars (waybar)** — Pango falls back automatically; add the font to the
stack:

```css
* {
  font-family: "Your Nerd Font", "lobe-icons", sans-serif;
}
```

```bash
printf '\U000F4014'   # anthropic
printf '\U000F40D0'   # openai
```

**Terminals** — map the range to the font:

```ini
# kitty
symbol_map U+F4000-U+F47FF lobe-icons
# ghostty
font-codepoint-map = U+F4000-U+F47FF=lobe-icons
# foot
font=Your Mono:size=11, lobe-icons:size=11
```

Alacritty has no per-glyph fallback and is not supported.

**Web** — the build also emits a stylesheet with one class per icon, so you can
use `<i class="li li-anthropic"></i>` after loading `lobe-icons.css`. See the
[demo site](https://hschne.github.io/lobe-icons-font/).

## Codepoints

Glyphs occupy `U+F4000–U+F4134` today, inside the reserved `U+F4000–U+F47FF`
block (2048 slots). New icons append to the next free slot; removed icons keep
their slot reserved so existing mappings stay valid forever.

## Development

```bash
npm run build       # build dist/lobe-icons.ttf + codepoints.json
npm run build:docs  # generate the demo site assets in docs/
npm run check       # rebuild and assert nothing changed
```

The build is one Node script: collect monochrome icons from
`@lobehub/icons/es/*/components/Mono.js` (falling back to `Color.js` when a Mono
icon just wraps the color one), assign stable codepoints, generate the TTF, and
assert format-12 cmap mappings plus clipping-safe vertical metrics.

The package version mirrors `@lobehub/icons`. To release: bump both versions
together, run `npm run check`, commit, then trigger the **Release icons** GitHub
Action — it tags `v<version>` and uploads `dist/lobe-icons.ttf`.

## Credits & license

Icons are from [LobeHub](https://github.com/lobehub/lobe-icons). Brand logos may
be subject to their owners' trademarks and copyright — fine for personal use,
check before redistributing. The build tooling in this repo is MIT licensed.

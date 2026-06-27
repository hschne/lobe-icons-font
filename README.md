<div align="center">

# Lobe Icons Font

A glyph font of **309 monochrome AI / LLM provider logos** for terminals,
status bars, and the web.

[Browse the icons](https://lif.hansschnedlitz.com/) ·
[Source icons by LobeHub](https://github.com/lobehub/lobe-icons)

<img src="docs/assets/preview.png" alt="All 309 Lobe Icons Font glyphs, each shown next to its name" width="100%" />

</div>

## Install

Download `lobe-icons.ttf` from the [latest release](https://github.com/hschne/lobe-icons-font/releases/latest),
then install it.

```bash
# Download the font
curl -L -o lobe-icons.ttf https://github.com/hschne/lobe-icons-font/releases/latest/download/lobe-icons.ttf
```

## Use

The font uses plane 15, so only terminals with font-fallback mechnaism are supported.

```ini
# kitty
symbol_map U+F4000-U+F47FF lobe-icons

# ghostty
font-codepoint-map = U+F4000-U+F47FF=lobe-icons

# foot
font=Your Mono:size=11, lobe-icons:size=11
```

On the **Web**, load the hosted stylesheet and use a class per icon:

```html
<link
  rel="stylesheet"
  href="https://lif.hansschnedlitz.com/assets/lobe-icons.css"
/>
<i class="li li-anthropic"></i>
```

## Development

```bash
npm run build
```

The build is one Node script. It collects monochrome icons from `@lobehub/icons/es/*/components/Mono.js` and generates the TTF. The package version and releases mirror `@lobehub/icons`.

## Trademark & license

The build tooling in this repo is MIT licensed (see [LICENSE](LICENSE)).

The glyphs are derived from [LobeHub](https://github.com/lobehub/lobe-icons)'s
lobe-icons and depict third-party logos. All product names, logos, and brands
are the property of their respective owners. They appear here for identification
only (nominative use) and do not imply any affiliation with, sponsorship by, or
endorsement from those companies. Brand logos are trademarks and are not covered
by the MIT license.

This font is meant for personal use - theming terminals, status bars, and
prompts. If you redistribute, bundle it into a product, or use it commercially,
review each brand's trademark guidelines first.

Brand owner and want your logo removed? [Open an issue](https://github.com/hschne/lobe-icons-font/issues/new)
and I'll drop it.

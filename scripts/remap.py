#!/usr/bin/env python3
"""Pin codepoints and rewrite the cmap as format-12 (UCS-4).

fantasticon emits a BMP-only cmap, which truncates anything above U+FFFF. Our
icons live in Plane 15 at U+F4000-U+F47FF (clear of Nerd Fonts' Material Design
block at U+F0001-U+F1AF0), so we rewrite the cmap with a format-12 subtable.

Mapping is STABLE: codepoints.json is the source of truth. Existing names keep
their codepoint forever; new icons append to the next free slot; removed names
keep their slot reserved (never reused). This keeps hardcoded glyphs in configs
valid across resyncs.
"""
import json
import os
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._c_m_a_p import CmapSubtable
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen

BASE = 0xF4000
CEILING = 0xF47FF  # 2048-slot reserved block
TTF = Path("dist/lobe-icons.ttf")
MAP = Path("codepoints.json")
SVG = Path("svg")

# fantasticon emits glyphs filling the full em (y=0..em), so they sit too high
# next to text. Nerd Fonts' Material Design icons instead span y=[-0.062em,
# 0.772em] - ~0.83em tall, centered ~0.355em above the baseline. Match that:
# scale glyphs down and shift them onto the text's optical center.
ICON_YMIN = -0.062
ICON_YMAX = 0.772


def reposition(font: TTFont) -> None:
    upm = font["head"].unitsPerEm
    scale = ICON_YMAX - ICON_YMIN  # source box is a full em (0..1)
    ty = round(ICON_YMIN * upm)
    tx = round(upm * (1 - scale) / 2)  # re-center horizontally in the advance
    glyf = font["glyf"]
    gs = font.getGlyphSet()
    redrawn = {}
    for name in glyf.keys():
        pen = TTGlyphPen(gs)
        gs[name].draw(TransformPen(pen, (scale, 0, 0, scale, tx, ty)))
        redrawn[name] = pen.glyph()
    for name, glyph in redrawn.items():
        glyf[name] = glyph

    descent = -ty + round(0.02 * upm)  # cover the new sub-baseline extent
    font["hhea"].ascent = upm
    font["hhea"].descent = -descent
    os2 = font["OS/2"]
    os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = upm, -descent, 0
    os2.usWinAscent = round(ICON_YMAX * upm) + round(0.02 * upm)
    os2.usWinDescent = descent


def main() -> int:
    font = TTFont(TTF)
    in_font = set(font.getGlyphOrder())
    # The svg/ dir is the authoritative icon list; ignore stray font artifacts.
    icons = sorted(p.stem for p in SVG.glob("*.svg"))

    pins = json.loads(MAP.read_text()) if MAP.exists() else {}
    pins = {name: int(cp) for name, cp in pins.items()}

    next_cp = max(pins.values()) + 1 if pins else BASE
    for name in icons:
        if name not in pins:
            pins[name] = next_cp
            next_cp += 1

    used = max(pins.values()) if pins else BASE
    if used > CEILING:
        sys.exit(f"out of room: U+{used:X} exceeds block ceiling U+{CEILING:X}")

    # Only map glyphs that actually exist in the font (skip reserved-but-removed).
    cmap = {cp: name for name, cp in pins.items() if name in in_font}

    def subtable(platform_id: int, plat_enc_id: int) -> CmapSubtable:
        st = CmapSubtable.getSubtableClass(12)(12)
        st.format, st.reserved, st.length = 12, 0, 0
        st.language, st.nGroups = 0, 0
        st.platformID, st.platEncID = platform_id, plat_enc_id
        st.cmap = dict(cmap)
        return st

    font["cmap"].tableVersion = 0
    font["cmap"].tables = [subtable(3, 10), subtable(0, 4)]
    reposition(font)
    font.save(TTF)

    MAP.write_text(json.dumps(dict(sorted(pins.items(), key=lambda kv: kv[1])), indent=2) + "\n")
    print(f"mapped {len(cmap)} glyphs into U+{BASE:X}-U+{used:X}; pins in {MAP}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

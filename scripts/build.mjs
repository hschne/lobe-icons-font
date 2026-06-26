import {
  copyFileSync,
  createReadStream,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import svg2ttf from "svg2ttf";
import SVGIcons2SVGFontStream from "svgicons2svgfont";
import svgpath from "svgpath";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "node_modules/@lobehub/icons-static-svg/icons");
const SVG_DIR = join(ROOT, "svg");
const DIST_DIR = join(ROOT, "dist");
const TTF_PATH = join(DIST_DIR, "lobe-icons.ttf");
const CODEPOINTS_PATH = join(ROOT, "codepoints.json");

const FONT_NAME = "lobe-icons";
const FONT_HEIGHT = 300;
const BASE_CODEPOINT = 0xf4000;
const CEILING_CODEPOINT = 0xf47ff;
const ICON_YMIN = -0.062;
const ICON_YMAX = 0.772;

const GLYPH_SCALE = ICON_YMAX - ICON_YMIN;
const GLYPH_TX = Math.round((FONT_HEIGHT * (1 - GLYPH_SCALE)) / 2);
const GLYPH_TY = Math.round(ICON_YMIN * FONT_HEIGHT);
const FONT_DESCENT = -GLYPH_TY + Math.round(0.02 * FONT_HEIGHT);
const WIN_ASCENT =
  Math.round(ICON_YMAX * FONT_HEIGHT) + Math.round(0.02 * FONT_HEIGHT);
const CHECKSUM_ADJUSTMENT = 0xb1b0afba;

async function main() {
  const icons = collectIcons();
  const pins = assignCodepoints(icons, readCodepoints());
  const svgFont = repositionSvgFont(await generateSvgFont(icons, pins));
  const ttf = buildTtf(svgFont, icons, pins);

  mkdirSync(DIST_DIR, { recursive: true });
  writeFileSync(TTF_PATH, ttf);
  writeCodepoints(pins);

  const used = Math.max(...pins.values());
  console.log(`collected ${icons.length} monochrome icons into svg/`);
  console.log(
    `mapped ${icons.length} glyphs into U+${BASE_CODEPOINT.toString(16).toUpperCase()}-U+${used.toString(16).toUpperCase()}`,
  );
  console.log("done: dist/lobe-icons.ttf");
}

function collectIcons() {
  const files = readdirSync(SOURCE_DIR)
    .filter((file) => /^[a-z0-9]+\.svg$/.test(file))
    .sort();

  rmSync(SVG_DIR, { recursive: true, force: true });
  mkdirSync(SVG_DIR, { recursive: true });

  for (const file of files) {
    copyFileSync(join(SOURCE_DIR, file), join(SVG_DIR, file));
  }

  return files.map((file) => basename(file, ".svg"));
}

function readCodepoints() {
  let raw;

  try {
    raw = JSON.parse(readFileSync(CODEPOINTS_PATH, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }

  const pins = new Map();
  const used = new Map();

  for (const [name, codepoint] of Object.entries(raw)) {
    if (!Number.isInteger(codepoint)) {
      throw new Error(`Invalid codepoint for ${name}: ${codepoint}`);
    }
    if (codepoint < BASE_CODEPOINT || codepoint > CEILING_CODEPOINT) {
      throw new Error(
        `Codepoint for ${name} is outside U+F4000-U+F47FF: U+${codepoint.toString(16).toUpperCase()}`,
      );
    }
    if (used.has(codepoint)) {
      throw new Error(
        `Duplicate codepoint U+${codepoint.toString(16).toUpperCase()} for ${used.get(codepoint)} and ${name}`,
      );
    }

    pins.set(name, codepoint);
    used.set(codepoint, name);
  }

  return pins;
}

function assignCodepoints(icons, pins) {
  let nextCodepoint =
    pins.size === 0 ? BASE_CODEPOINT : Math.max(...pins.values()) + 1;

  for (const name of icons) {
    if (pins.has(name)) continue;

    pins.set(name, nextCodepoint);
    nextCodepoint += 1;
  }

  const used = Math.max(...pins.values());
  if (used > CEILING_CODEPOINT) {
    throw new Error(
      `Out of room: U+${used.toString(16).toUpperCase()} exceeds U+${CEILING_CODEPOINT.toString(16).toUpperCase()}`,
    );
  }

  return pins;
}

function generateSvgFont(icons, pins) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const fontStream = new SVGIcons2SVGFontStream({
      fontName: FONT_NAME,
      fontId: FONT_NAME,
      fontHeight: FONT_HEIGHT,
      normalize: true,
      log: () => {},
    });

    fontStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    fontStream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    fontStream.on("error", reject);

    for (const name of icons) {
      const glyph = createReadStream(join(SVG_DIR, `${name}.svg`));
      glyph.on("error", reject);
      glyph.metadata = {
        name,
        unicode: [String.fromCodePoint(pins.get(name))],
      };
      fontStream.write(glyph);
    }

    fontStream.end();
  });
}

function repositionSvgFont(svgFont) {
  let patchedMetrics = false;
  let patchedGlyphs = 0;

  const withMetrics = svgFont.replace(
    /(<font-face\b[\s\S]*?\bascent=")[^"]+("[\s\S]*?\bdescent=")[^"]+("[\s\S]*?\/>)/,
    (_match, beforeAscent, beforeDescent, afterDescent) => {
      patchedMetrics = true;
      return `${beforeAscent}${FONT_HEIGHT}${beforeDescent}-${FONT_DESCENT}${afterDescent}`;
    },
  );

  const positioned = withMetrics.replace(
    /(<glyph\b[\s\S]*?\sd=")([^"]*)("[\s\S]*?\/>)/g,
    (_match, beforePath, pathData, afterPath) => {
      patchedGlyphs += 1;
      const nextPath = svgpath(pathData)
        .scale(GLYPH_SCALE, GLYPH_SCALE)
        .translate(GLYPH_TX, GLYPH_TY)
        .round(3)
        .toString();

      return `${beforePath}${nextPath}${afterPath}`;
    },
  );

  if (!patchedMetrics) throw new Error("Could not patch SVG font metrics");
  if (patchedGlyphs === 0) throw new Error("Generated SVG font has no glyphs");

  return positioned;
}

function buildTtf(svgFont, icons, pins) {
  const expectedCodepoints = icons.map((name) => pins.get(name));
  const ttf = Buffer.from(svg2ttf(svgFont, { ts: sourceDateEpoch() }).buffer);

  rewriteCmap(ttf, expectedCodepoints);
  fixTtfMetrics(ttf);
  recalculateGlyphBounds(ttf);
  assertFormat12Mappings(ttf, expectedCodepoints);
  recalculateChecksums(ttf);

  return ttf;
}

function sourceDateEpoch() {
  const value = Number.parseInt(process.env.SOURCE_DATE_EPOCH ?? "0", 10);
  if (!Number.isFinite(value))
    throw new Error("SOURCE_DATE_EPOCH must be an integer");
  return value;
}

function fixTtfMetrics(ttf) {
  const tables = readTableDirectory(ttf);
  const hhea = requireTable(tables, "hhea");
  const os2 = requireTable(tables, "OS/2");

  ttf.writeInt16BE(FONT_HEIGHT, hhea.offset + 4);
  ttf.writeInt16BE(-FONT_DESCENT, hhea.offset + 6);
  ttf.writeInt16BE(0, hhea.offset + 8);

  ttf.writeInt16BE(FONT_HEIGHT, os2.offset + 68);
  ttf.writeInt16BE(-FONT_DESCENT, os2.offset + 70);
  ttf.writeInt16BE(0, os2.offset + 72);
  ttf.writeUInt16BE(WIN_ASCENT, os2.offset + 74);
  ttf.writeUInt16BE(FONT_DESCENT, os2.offset + 76);
}

function recalculateGlyphBounds(ttf) {
  const tables = readTableDirectory(ttf);
  const head = requireTable(tables, "head");
  const glyphRanges = readGlyphRanges(ttf, tables);
  let fontBounds;

  for (const { start, end } of glyphRanges) {
    if (start === end) continue;

    const glyphOffset = requireTable(tables, "glyf").offset + start;
    const bounds = glyphBounds(ttf, glyphOffset);
    if (!bounds) continue;

    writeGlyphBounds(ttf, glyphOffset, bounds);
    fontBounds = mergeBounds(fontBounds, bounds);
  }

  if (fontBounds) writeFontBounds(ttf, head.offset, fontBounds);
}

function readGlyphRanges(ttf, tables) {
  const head = requireTable(tables, "head");
  const loca = requireTable(tables, "loca");
  const maxp = requireTable(tables, "maxp");
  const numGlyphs = ttf.readUInt16BE(maxp.offset + 4);
  const indexToLocFormat = ttf.readInt16BE(head.offset + 50);
  const offsets = [];

  for (let index = 0; index <= numGlyphs; index += 1) {
    if (indexToLocFormat === 0) {
      offsets.push(ttf.readUInt16BE(loca.offset + index * 2) * 2);
    } else {
      offsets.push(ttf.readUInt32BE(loca.offset + index * 4));
    }
  }

  return offsets
    .slice(0, -1)
    .map((start, index) => ({ start, end: offsets[index + 1] }));
}

function glyphBounds(ttf, glyphOffset) {
  const contourCount = ttf.readInt16BE(glyphOffset);
  if (contourCount < 0) return readStoredGlyphBounds(ttf, glyphOffset);
  if (contourCount === 0) return null;

  const pointCount =
    ttf.readUInt16BE(glyphOffset + 10 + (contourCount - 1) * 2) + 1;
  const flags = readGlyphFlags(ttf, glyphOffset, contourCount, pointCount);
  const xStart = flags.endOffset;
  const xCoordinates = readGlyphCoordinates(
    ttf,
    xStart,
    flags.values,
    0x02,
    0x10,
  );
  const yCoordinates = readGlyphCoordinates(
    ttf,
    xCoordinates.endOffset,
    flags.values,
    0x04,
    0x20,
  );

  return coordinatesBounds(xCoordinates.values, yCoordinates.values);
}

function readGlyphFlags(ttf, glyphOffset, contourCount, pointCount) {
  const values = [];
  const instructionLengthOffset = glyphOffset + 10 + contourCount * 2;
  const instructionLength = ttf.readUInt16BE(instructionLengthOffset);
  let offset = instructionLengthOffset + 2 + instructionLength;

  while (values.length < pointCount) {
    const flag = ttf.readUInt8(offset);
    offset += 1;
    values.push(flag);

    if ((flag & 0x08) === 0) continue;

    const repeats = ttf.readUInt8(offset);
    offset += 1;
    for (let index = 0; index < repeats; index += 1) values.push(flag);
  }

  return { values, endOffset: offset };
}

function readGlyphCoordinates(
  ttf,
  startOffset,
  flags,
  shortBit,
  sameOrPositiveBit,
) {
  const values = [];
  let offset = startOffset;
  let coordinate = 0;

  for (const flag of flags) {
    const { delta, endOffset } = readCoordinateDelta(
      ttf,
      offset,
      flag,
      shortBit,
      sameOrPositiveBit,
    );
    coordinate += delta;
    offset = endOffset;
    values.push(coordinate);
  }

  return { values, endOffset: offset };
}

function readCoordinateDelta(ttf, offset, flag, shortBit, sameOrPositiveBit) {
  if ((flag & shortBit) !== 0) {
    const value = ttf.readUInt8(offset);
    const sign = (flag & sameOrPositiveBit) !== 0 ? 1 : -1;
    return { delta: value * sign, endOffset: offset + 1 };
  }

  if ((flag & sameOrPositiveBit) !== 0) return { delta: 0, endOffset: offset };

  return { delta: ttf.readInt16BE(offset), endOffset: offset + 2 };
}

function coordinatesBounds(xs, ys) {
  return {
    xMin: Math.min(...xs),
    yMin: Math.min(...ys),
    xMax: Math.max(...xs),
    yMax: Math.max(...ys),
  };
}

function readStoredGlyphBounds(ttf, glyphOffset) {
  return {
    xMin: ttf.readInt16BE(glyphOffset + 2),
    yMin: ttf.readInt16BE(glyphOffset + 4),
    xMax: ttf.readInt16BE(glyphOffset + 6),
    yMax: ttf.readInt16BE(glyphOffset + 8),
  };
}

function writeGlyphBounds(ttf, glyphOffset, bounds) {
  ttf.writeInt16BE(bounds.xMin, glyphOffset + 2);
  ttf.writeInt16BE(bounds.yMin, glyphOffset + 4);
  ttf.writeInt16BE(bounds.xMax, glyphOffset + 6);
  ttf.writeInt16BE(bounds.yMax, glyphOffset + 8);
}

function mergeBounds(current, next) {
  if (!current) return { ...next };

  return {
    xMin: Math.min(current.xMin, next.xMin),
    yMin: Math.min(current.yMin, next.yMin),
    xMax: Math.max(current.xMax, next.xMax),
    yMax: Math.max(current.yMax, next.yMax),
  };
}

function writeFontBounds(ttf, headOffset, bounds) {
  ttf.writeInt16BE(bounds.xMin, headOffset + 36);
  ttf.writeInt16BE(bounds.yMin, headOffset + 38);
  ttf.writeInt16BE(bounds.xMax, headOffset + 40);
  ttf.writeInt16BE(bounds.yMax, headOffset + 42);
}

function rewriteCmap(ttf, expectedCodepoints) {
  const tables = readTableDirectory(ttf);
  const cmap = requireTable(tables, "cmap");
  const mappings = readFormat12Mappings(ttf);
  const subtableLength = 16 + expectedCodepoints.length * 12;
  const cmapLength = 20 + subtableLength;

  if (cmapLength > cmap.length) {
    throw new Error(
      `Generated cmap table is too small to rewrite (${cmapLength} > ${cmap.length})`,
    );
  }

  ttf.writeUInt16BE(0, cmap.offset);
  ttf.writeUInt16BE(2, cmap.offset + 2);
  writeCmapRecord(ttf, cmap.offset + 4, 0, 4, 20);
  writeCmapRecord(ttf, cmap.offset + 12, 3, 10, 20);
  writeFormat12Subtable(ttf, cmap.offset + 20, expectedCodepoints, mappings);
  ttf.fill(0, cmap.offset + cmapLength, cmap.offset + cmap.length);
  ttf.writeUInt32BE(cmapLength, cmap.recordOffset + 12);
}

function writeCmapRecord(ttf, offset, platformId, encodingId, subtableOffset) {
  ttf.writeUInt16BE(platformId, offset);
  ttf.writeUInt16BE(encodingId, offset + 2);
  ttf.writeUInt32BE(subtableOffset, offset + 4);
}

function writeFormat12Subtable(ttf, offset, codepoints, mappings) {
  const sortedCodepoints = [...codepoints].sort((left, right) => left - right);
  const length = 16 + sortedCodepoints.length * 12;

  ttf.writeUInt16BE(12, offset);
  ttf.writeUInt16BE(0, offset + 2);
  ttf.writeUInt32BE(length, offset + 4);
  ttf.writeUInt32BE(0, offset + 8);
  ttf.writeUInt32BE(sortedCodepoints.length, offset + 12);

  sortedCodepoints.forEach((codepoint, index) => {
    const glyphId = mappings.get(codepoint);
    if (glyphId == null) {
      throw new Error(
        `Missing source glyph ID for U+${codepoint.toString(16).toUpperCase()}`,
      );
    }

    const groupOffset = offset + 16 + index * 12;
    ttf.writeUInt32BE(codepoint, groupOffset);
    ttf.writeUInt32BE(codepoint, groupOffset + 4);
    ttf.writeUInt32BE(glyphId, groupOffset + 8);
  });
}

function assertFormat12Mappings(ttf, expectedCodepoints) {
  const mapped = readFormat12Mappings(ttf);

  for (const codepoint of expectedCodepoints) {
    if (!mapped.has(codepoint)) {
      throw new Error(
        `Missing cmap mapping for U+${codepoint.toString(16).toUpperCase()}`,
      );
    }
  }
}

function readFormat12Mappings(ttf) {
  const cmap = requireTable(readTableDirectory(ttf), "cmap");
  const tableCount = ttf.readUInt16BE(cmap.offset + 2);
  const mappings = new Map();

  for (let index = 0; index < tableCount; index += 1) {
    const recordOffset = cmap.offset + 4 + index * 8;
    const subtableOffset = cmap.offset + ttf.readUInt32BE(recordOffset + 4);
    if (ttf.readUInt16BE(subtableOffset) !== 12) continue;

    const groupCount = ttf.readUInt32BE(subtableOffset + 12);
    for (let group = 0; group < groupCount; group += 1) {
      const groupOffset = subtableOffset + 16 + group * 12;
      const start = ttf.readUInt32BE(groupOffset);
      const end = ttf.readUInt32BE(groupOffset + 4);
      const startGlyphId = ttf.readUInt32BE(groupOffset + 8);
      for (let codepoint = start; codepoint <= end; codepoint += 1) {
        mappings.set(codepoint, startGlyphId + codepoint - start);
      }
    }
  }

  if (mappings.size === 0)
    throw new Error("Generated font has no format-12 cmap mappings");
  return mappings;
}

function recalculateChecksums(ttf) {
  const tables = readTableDirectory(ttf);
  const head = requireTable(tables, "head");
  ttf.writeUInt32BE(0, head.offset + 8);

  for (const table of tables.values()) {
    ttf.writeUInt32BE(
      checksum(ttf, table.offset, table.length),
      table.recordOffset + 4,
    );
  }

  const adjustment = (CHECKSUM_ADJUSTMENT - checksum(ttf, 0, ttf.length)) >>> 0;
  ttf.writeUInt32BE(adjustment, head.offset + 8);
}

function checksum(buffer, offset, length) {
  let sum = 0;
  const paddedLength = length + ((4 - (length % 4)) % 4);

  for (let index = 0; index < paddedLength; index += 4) {
    let value = 0;
    for (let byte = 0; byte < 4; byte += 1) {
      const nextOffset = offset + index + byte;
      value =
        (value << 8) + (nextOffset < offset + length ? buffer[nextOffset] : 0);
    }
    sum = (sum + value) >>> 0;
  }

  return sum;
}

function readTableDirectory(ttf) {
  const tables = new Map();
  const tableCount = ttf.readUInt16BE(4);

  for (let index = 0; index < tableCount; index += 1) {
    const recordOffset = 12 + index * 16;
    const tag = ttf.toString("ascii", recordOffset, recordOffset + 4);
    tables.set(tag, {
      recordOffset,
      offset: ttf.readUInt32BE(recordOffset + 8),
      length: ttf.readUInt32BE(recordOffset + 12),
    });
  }

  return tables;
}

function requireTable(tables, tag) {
  const table = tables.get(tag);
  if (!table) throw new Error(`Generated TTF is missing ${tag} table`);
  return table;
}

function writeCodepoints(pins) {
  const orderedPins = [...pins.entries()].sort(
    (left, right) => left[1] - right[1],
  );
  writeFileSync(
    CODEPOINTS_PATH,
    `${JSON.stringify(Object.fromEntries(orderedPins), null, 2)}\n`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

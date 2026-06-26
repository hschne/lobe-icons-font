import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import svg2ttf from "svg2ttf";
import SVGIcons2SVGFontStream from "svgicons2svgfont";
import svgpath from "svgpath";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "node_modules/@lobehub/icons/es");
const DIST_DIR = join(ROOT, "dist");
const TTF_PATH = join(DIST_DIR, "lobe-icons.ttf");
const CODEPOINTS_PATH = join(ROOT, "codepoints.json");

const FONT_NAME = "lobe-icons";
const FONT_HEIGHT = 300;
const BASE_CODEPOINT = 0xf4000;
const CEILING_CODEPOINT = 0xf47ff;
const CHECKSUM_ADJUSTMENT = 0xb1b0afba;
const ICON_YMIN = -0.062;
const ICON_YMAX = 0.772;

const GLYPH_SCALE = ICON_YMAX - ICON_YMIN;
const GLYPH_TX = Math.round((FONT_HEIGHT * (1 - GLYPH_SCALE)) / 2);
const GLYPH_TY = Math.round(ICON_YMIN * FONT_HEIGHT);
const FONT_DESCENT = -GLYPH_TY + Math.round(0.02 * FONT_HEIGHT);
const WIN_ASCENT =
  Math.round(ICON_YMAX * FONT_HEIGHT) + Math.round(0.02 * FONT_HEIGHT);

async function main() {
  const icons = collectIcons();
  const pins = assignCodepoints(icons, readCodepoints());
  const svgFont = repositionSvgFont(await generateSvgFont(icons, pins));
  const ttf = buildTtf(svgFont, icons, pins);

  mkdirSync(DIST_DIR, { recursive: true });
  writeFileSync(TTF_PATH, ttf);
  writeCodepoints(pins);

  console.log(`collected ${icons.length} icons from @lobehub/icons`);
  console.log(
    `mapped ${icons.length} glyphs into ${formatCodepoint(BASE_CODEPOINT)}-${formatCodepoint(Math.max(...pins.values()))}`,
  );
  console.log("done: dist/lobe-icons.ttf");
}

function collectIcons() {
  return readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name.toLowerCase(),
      sourceName: entry.name,
    }))
    .filter((icon) => /^[a-z0-9]+$/.test(icon.name))
    .filter((icon) =>
      hasFile(join(SOURCE_DIR, icon.sourceName, "components/Mono.js")),
    )
    .sort((left, right) => left.name.localeCompare(right.name));
}

function hasFile(path) {
  try {
    readFileSync(path, "utf8");
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function readCodepoints() {
  try {
    const raw = JSON.parse(readFileSync(CODEPOINTS_PATH, "utf8"));
    const pins = new Map();
    const used = new Map();

    for (const [name, codepoint] of Object.entries(raw)) {
      if (!Number.isInteger(codepoint))
        throw new Error(`Invalid codepoint for ${name}: ${codepoint}`);
      if (codepoint < BASE_CODEPOINT || codepoint > CEILING_CODEPOINT) {
        throw new Error(
          `Codepoint for ${name} is outside ${formatCodepoint(BASE_CODEPOINT)}-${formatCodepoint(CEILING_CODEPOINT)}: ${formatCodepoint(codepoint)}`,
        );
      }
      if (used.has(codepoint)) {
        throw new Error(
          `Duplicate codepoint ${formatCodepoint(codepoint)} for ${used.get(codepoint)} and ${name}`,
        );
      }

      pins.set(name, codepoint);
      used.set(codepoint, name);
    }

    return pins;
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }
}

function assignCodepoints(icons, pins) {
  let nextCodepoint =
    pins.size === 0 ? BASE_CODEPOINT : Math.max(...pins.values()) + 1;

  for (const { name } of icons) {
    if (!pins.has(name)) pins.set(name, nextCodepoint++);
  }

  const used = Math.max(...pins.values());
  if (used > CEILING_CODEPOINT) {
    throw new Error(
      `Out of room: ${formatCodepoint(used)} exceeds ${formatCodepoint(CEILING_CODEPOINT)}`,
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

    for (const icon of icons) {
      const glyph = Readable.from([componentToSvg(icon.sourceName)]);
      glyph.metadata = {
        name: icon.name,
        unicode: [String.fromCodePoint(pins.get(icon.name))],
      };
      fontStream.write(glyph);
    }

    fontStream.end();
  });
}

function componentToSvg(sourceName) {
  let source = readFileSync(
    join(SOURCE_DIR, sourceName, "components/Mono.js"),
    "utf8",
  );
  let paths = pathData(source);

  if (paths.length === 0) {
    source = readFileSync(
      join(SOURCE_DIR, sourceName, "components/Color.js"),
      "utf8",
    );
    paths = pathData(source);
  }
  if (paths.length === 0)
    throw new Error(`No path data found for ${sourceName}`);

  const viewBox = source.match(/viewBox: "([^"]+)"/)?.[1] ?? "0 0 24 24";
  // Some icons (e.g. ZenMux) author their path in a larger coordinate space and
  // fit it to the viewBox with a wrapping <g transform="scale(...)">. Bake that
  // transform into the path data; otherwise the oversized outline escapes the
  // viewBox and blows out the font's bounds and vertical metrics.
  const transform = source.match(/transform: "([^"]+)"/)?.[1];
  const body = paths
    .map((path) => {
      const d = transform
        ? svgpath(path).transform(transform).round(3).toString()
        : path;
      return `<path d="${escapeXml(d)}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
}

function pathData(source) {
  return [...source.matchAll(/\bd: "([^"]+)"/g)].map((match) => match[1]);
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
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
    (_match, beforePath, path, afterPath) => {
      patchedGlyphs += 1;
      const nextPath = svgpath(path)
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
  const expectedCodepoints = icons.map((icon) => pins.get(icon.name));
  const ttf = Buffer.from(svg2ttf(svgFont, { ts: sourceDateEpoch() }).buffer);
  const bounds = readHeadBounds(ttf);

  fixTtfMetrics(ttf, bounds);
  assertFormat12Mappings(ttf, expectedCodepoints);
  assertMetricsCoverBounds(ttf, bounds);
  recalculateChecksums(ttf);

  return ttf;
}

function sourceDateEpoch() {
  const value = Number.parseInt(process.env.SOURCE_DATE_EPOCH ?? "0", 10);
  if (!Number.isFinite(value))
    throw new Error("SOURCE_DATE_EPOCH must be an integer");
  return value;
}

function fixTtfMetrics(ttf, bounds) {
  const tables = readTableDirectory(ttf);
  const hhea = requireTable(tables, "hhea");
  const os2 = requireTable(tables, "OS/2");
  const descent = Math.max(FONT_DESCENT, -bounds.yMin);
  const ascent = Math.max(FONT_HEIGHT, bounds.yMax);
  const winAscent = Math.max(WIN_ASCENT, bounds.yMax);

  ttf.writeInt16BE(ascent, hhea.offset + 4);
  ttf.writeInt16BE(-descent, hhea.offset + 6);
  ttf.writeInt16BE(0, hhea.offset + 8);

  ttf.writeInt16BE(ascent, os2.offset + 68);
  ttf.writeInt16BE(-descent, os2.offset + 70);
  ttf.writeInt16BE(0, os2.offset + 72);
  ttf.writeUInt16BE(winAscent, os2.offset + 74);
  ttf.writeUInt16BE(descent, os2.offset + 76);
}

function assertMetricsCoverBounds(ttf, bounds) {
  const tables = readTableDirectory(ttf);
  const hhea = requireTable(tables, "hhea");
  const os2 = requireTable(tables, "OS/2");

  if (ttf.readInt16BE(hhea.offset + 4) < bounds.yMax)
    throw new Error("hhea ascender does not cover glyph bounds");
  if (ttf.readInt16BE(hhea.offset + 6) > bounds.yMin)
    throw new Error("hhea descender does not cover glyph bounds");
  if (ttf.readInt16BE(os2.offset + 68) < bounds.yMax)
    throw new Error("OS/2 ascender does not cover glyph bounds");
  if (ttf.readInt16BE(os2.offset + 70) > bounds.yMin)
    throw new Error("OS/2 descender does not cover glyph bounds");
  if (ttf.readUInt16BE(os2.offset + 74) < bounds.yMax)
    throw new Error("OS/2 winAscent does not cover glyph bounds");
  if (ttf.readUInt16BE(os2.offset + 76) < -bounds.yMin)
    throw new Error("OS/2 winDescent does not cover glyph bounds");
}

function assertFormat12Mappings(ttf, expectedCodepoints) {
  const mapped = readFormat12Mappings(ttf);

  for (const codepoint of expectedCodepoints) {
    if (!mapped.has(codepoint))
      throw new Error(`Missing cmap mapping for ${formatCodepoint(codepoint)}`);
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

function readHeadBounds(ttf) {
  const head = requireTable(readTableDirectory(ttf), "head");
  return {
    yMin: ttf.readInt16BE(head.offset + 38),
    yMax: ttf.readInt16BE(head.offset + 42),
  };
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

function formatCodepoint(codepoint) {
  return `U+${codepoint.toString(16).toUpperCase()}`;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

// Renders a 5x4 grid of well-known AI tools with their Lobe Icons glyphs.
// Meant to be run in a terminal whose font falls back to lobe-icons
// (kitty, ghostty, foot) so you can screenshot it for socials/README.
//
//   npm run demo
//
// Belongs in the repo at scripts/demo.mjs. Reads codepoints.json for the
// slug -> codepoint mapping. Display names are curated here for readability
// (the font ships machine titles like "HuggingFace").

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CODEPOINTS_PATH = join(ROOT, "codepoints.json");

// 20 tools, ordered for the grid (5 columns x 4 rows).
const GRID = [
  ["openai", "OpenAI"],
  ["claude", "Claude"],
  ["gemini", "Gemini"],
  ["cursor", "Cursor"],
  ["claudecode", "Claude Code"],
  ["githubcopilot", "Copilot"],
  ["perplexity", "Perplexity"],
  ["mistral", "Mistral"],
  ["meta", "Meta"],
  ["grok", "Grok"],
  ["deepseek", "DeepSeek"],
  ["ollama", "Ollama"],
  ["huggingface", "Hugging Face"],
  ["midjourney", "Midjourney"],
  ["groq", "Groq"],
  ["windsurf", "Windsurf"],
  ["v0", "v0"],
  ["replit", "Replit"],
  ["runway", "Runway"],
  ["qwen", "Qwen"],
];

const COLUMNS = 5;
const CELL_WIDTH = 16;

const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function main() {
  const codepoints = JSON.parse(readFileSync(CODEPOINTS_PATH, "utf8"));

  const cells = GRID.map(([slug, name]) => {
    const codepoint = codepoints[slug];
    if (codepoint === undefined) throw new Error(`unknown slug: ${slug}`);
    const glyph = String.fromCodePoint(codepoint);
    const label = `${glyph}  ${name}`;
    // Glyph counts as one column but renders wider; pad to a stable cell.
    const pad = Math.max(0, CELL_WIDTH - (name.length + 3));
    return label + " ".repeat(pad);
  });

  const out = [];
  out.push("");
  out.push(
    `  ${BOLD}Lobe Icons Font${RESET}  ${DIM}309 AI provider glyphs for your terminal${RESET}`,
  );
  out.push("");
  for (let row = 0; row < cells.length; row += COLUMNS) {
    out.push("  " + cells.slice(row, row + COLUMNS).join(""));
    out.push("");
  }
  out.push(`  ${DIM}github.com/hschne/lobe-icons-font${RESET}`);
  out.push("");

  process.stdout.write(out.join("\n") + "\n");
}

main();

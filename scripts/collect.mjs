// Copy monochrome base icons from @lobehub/icons-static-svg into svg/.
// Skips -color / -text / -brand / -cn variants: a glyph font is single-color,
// so only the plain `name.svg` silhouettes are useful. Base ids have no hyphen.
import { readdirSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const src = "node_modules/@lobehub/icons-static-svg/icons";
const dest = "svg";

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

const names = readdirSync(src).filter((f) => /^[a-z0-9]+\.svg$/.test(f));
for (const name of names) copyFileSync(join(src, name), join(dest, name));

console.log(`collected ${names.length} monochrome icons into ${dest}/`);

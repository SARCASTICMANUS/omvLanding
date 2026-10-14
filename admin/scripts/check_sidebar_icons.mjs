/**
 * Every tab in the sidebar must resolve to an icon.
 *
 * This is not cosmetic: Sidebar.jsx renders `{Icon && <Icon .../>}`, so a tab
 * missing from `iconMap` gets no glyph AND its label loses the 19px+gap offset,
 * leaving it visibly out of line with every other row. That is exactly what
 * happened to "Dynamic Routing" until `Waypoints` was added.
 *
 * Run from the admin/ directory:  node scripts/check_sidebar_icons.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "src", "components", "Sidebar.jsx"), "utf8");
const app = readFileSync(join(here, "..", "src", "App.jsx"), "utf8");

const start = src.indexOf("const iconMap");
const mapBlock = src.slice(start, src.indexOf("};", start));

const declared = [
  ...mapBlock.matchAll(/"([a-z-]+)":|(\b[a-z][a-zA-Z]*):/g),
].map((m) => m[1] || m[2]);

// Tabs are the `id:` fields of the array App.jsx passes to <Sidebar tabs={...} />.
const tabsBlock = app.slice(app.indexOf("const tabs = ["), app.indexOf("];", app.indexOf("const tabs = [")));
const tabs = [...tabsBlock.matchAll(/id:\s*"([a-z-]+)"/g)].map((m) => m[1]);

const missing = tabs.filter((t) => !declared.includes(t));
const unused = declared.filter((k) => !tabs.includes(k));

console.log("  tabs        :", tabs.join(", "));
console.log("  iconMap keys:", declared.join(", "));
console.log(`  ${missing.length === 0 ? "PASS" : "FAIL"} every tab resolves to an icon`);
if (missing.length) console.log("        missing:", missing.join(", "));
console.log(`  ${unused.length === 0 ? "PASS" : "WARN"} no orphaned iconMap entries`);
if (unused.length) console.log("        unused:", unused.join(", "));

process.exit(missing.length === 0 ? 0 : 1);
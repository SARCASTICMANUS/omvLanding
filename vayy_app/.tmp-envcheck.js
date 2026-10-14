const fs = require("fs");
for (const f of [".env", ".env.example"]) {
  console.log("== " + f);
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) { console.log("(no '=') " + t.slice(0, 40)); continue; }
    const name = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    console.log(name + " -> " + (val ? "SET (len " + val.length + ")" : "EMPTY"));
  }
}

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const distMain = path.join(repoRoot, "dist", "main.js");
const rootMain = path.join(repoRoot, "main.js");

if (!fs.existsSync(distMain)) {
  console.error("[booker] dist/main.js not found. Run the build first.");
  process.exit(1);
}

fs.copyFileSync(distMain, rootMain);
console.log(`[booker] Copied: ${distMain} -> ${rootMain}`);

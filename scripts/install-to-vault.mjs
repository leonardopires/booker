// scripts/install-to-vault.mjs
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function die(msg) {
  console.error(`\n[booker] ${msg}\n`);
  process.exit(1);
}

function cpFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[booker] Copied: ${src} -> ${dest}`);
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

// 1) Get vault path from env or argv
// Usage:
//   node scripts/install-to-vault.mjs "/path/to/Vault"
// or:
//   BOOKER_VAULT="/path/to/Vault" node scripts/install-to-vault.mjs
const vaultPath = process.env.BOOKER_VAULT || process.argv[2];
if (!vaultPath) {
  die('Vault path missing. Provide as arg or set BOOKER_VAULT.\nExample: node scripts/install-to-vault.mjs "/path/to/Vault"');
}

const repoRoot = process.cwd();
const distMain = path.join(repoRoot, "dist", "main.js");
const manifest = path.join(repoRoot, "manifest.json");

if (!exists(manifest)) die("manifest.json not found at repo root.");
if (!exists(path.join(repoRoot, "package.json"))) die("package.json not found. Run from repo root.");

// 2) Build
console.log("[booker] Running build...");
execSync("npm run build", { stdio: "inherit" });

if (!exists(distMain)) {
  die("dist/main.js not found after build. Check esbuild outdir is 'dist'.");
}

// 3) Validate vault structure
const obsidianDir = path.join(vaultPath, ".obsidian");
if (!exists(obsidianDir)) {
  die(`Vault does not look like an Obsidian vault (missing .obsidian): ${vaultPath}`);
}

const pluginDir = path.join(obsidianDir, "plugins", "booker");

// 4) Copy files
cpFile(distMain, path.join(pluginDir, "main.js"));
cpFile(manifest, path.join(pluginDir, "manifest.json"));

console.log(`\n[booker] Installed to: ${pluginDir}`);
console.log("[booker] Now restart Obsidian or toggle the plugin off/on to reload.\n");
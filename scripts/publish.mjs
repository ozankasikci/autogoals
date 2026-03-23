#!/usr/bin/env node
/**
 * Usage:
 *   node scripts/publish.mjs          # bump patch (default)
 *   node scripts/publish.mjs minor
 *   node scripts/publish.mjs major
 *   node scripts/publish.mjs 1.2.3    # explicit version
 */
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cliPkgPath = join(root, "packages/cli/package.json");

function run(cmd, cwd = root) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd });
}

// 1. Bump version in packages/cli/package.json
const pkg = JSON.parse(readFileSync(cliPkgPath, "utf-8"));
const current = pkg.version;
const bump = process.argv[2] || "patch";

let [major, minor, patch] = current.split(".").map(Number);
if (bump === "major") { major++; minor = 0; patch = 0; }
else if (bump === "minor") { minor++; patch = 0; }
else if (bump === "patch") { patch++; }
else if (/^\d+\.\d+\.\d+$/.test(bump)) { [major, minor, patch] = bump.split(".").map(Number); }
else { console.error(`Unknown bump type: ${bump}`); process.exit(1); }

const next = `${major}.${minor}.${patch}`;
pkg.version = next;
writeFileSync(cliPkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`\nBumped ${current} → ${next}\n`);

// 2. Build
run("node scripts/build-publish.mjs");

// 3. Publish
run("npm publish", join(root, "packages/cli"));

console.log(`\nautogoals@${next} published.`);

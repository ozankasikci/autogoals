import { execSync } from "child_process";
import { cpSync, mkdirSync, rmSync, chmodSync } from "fs";
import { join } from "path";
import { build } from "esbuild";

const root = new URL("..", import.meta.url).pathname;

function run(cmd, cwd = root, opts = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd, ...opts });
}

// 1. Build core (needed for type resolution)
// Use root-level tsc since workspace package symlinks may be stale
run(join(root, "node_modules/.bin/tsc") + " --build", join(root, "packages/core"));

// 2. Build dashboard with port baked in
// Use root-level vite since workspace package symlinks may be stale
run(join(root, "node_modules/.bin/vite") + " build", join(root, "packages/dashboard"), {
  env: { ...process.env, VITE_API_PORT: "17891" },
});

// 3. Copy dashboard dist into CLI dist/public
const dashSrc = join(root, "packages/dashboard/dist");
const dashDest = join(root, "packages/cli/dist/public");
rmSync(dashDest, { recursive: true, force: true });
mkdirSync(dashDest, { recursive: true });
cpSync(dashSrc, dashDest, { recursive: true });
console.log("Copied dashboard to packages/cli/dist/public");

// 4. Bundle CLI + API + core with esbuild (using JS API to avoid shebang quoting issues)
console.log("> esbuild packages/cli/src/index.ts --bundle --platform=node --format=esm ...");
await build({
  entryPoints: [join(root, "packages/cli/src/index.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: join(root, "packages/cli/dist/index.js"),
  external: ["better-sqlite3", "fsevents"],
  // Shebang + createRequire shim so CJS packages work in ESM output.
  // esbuild strips shebangs from source, so we must add it here.
  banner: {
    js: [
      "#!/usr/bin/env node",
      "import { createRequire } from 'module';",
      "const require = createRequire(import.meta.url);",
    ].join("\n"),
  },
});
console.log("esbuild complete");

// 5. Make the output executable
chmodSync(join(root, "packages/cli/dist/index.js"), 0o755);
console.log("Made packages/cli/dist/index.js executable");

console.log("\nBuild complete. To publish:");
console.log("  cd packages/cli && npm publish");

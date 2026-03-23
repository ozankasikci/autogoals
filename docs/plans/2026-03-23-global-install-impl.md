# Global Install Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make AutoGoals installable with `npm install -g autogoals` + `autogoals start`, serving everything on port 17891.

**Architecture:** The CLI package becomes the published `autogoals` npm package. The existing API server gains static file serving for the pre-built dashboard. A new `autogoals start` command starts the unified server. A `build:publish` script in root builds everything and bundles it with esbuild.

**Tech Stack:** TypeScript, Express, esbuild (bundler), Vite (dashboard build)

---

### Task 1: Change default API port to 17891

**Files:**
- Modify: `packages/api/src/index.ts`

**Step 1: Update the default port and log messages**

In `packages/api/src/index.ts`, change the `createServer` signature and log output:

```typescript
// Change this line:
export async function createServer(port = 4000): Promise<ServerInstance> {

// To:
export async function createServer(port = 17891): Promise<ServerInstance> {
```

Also update the auto-start block at the bottom:
```typescript
// Change this:
if (process.argv[1] && !process.argv[1].includes("vitest")) {
  createServer().then(({ start }) => start());
}

// To:
if (process.argv[1] && !process.argv[1].includes("vitest")) {
  const port = process.env.AUTOGOALS_PORT ? parseInt(process.env.AUTOGOALS_PORT) : 17891;
  createServer(port).then(({ start }) => start());
}
```

**Step 2: Verify the change**

```bash
grep "port = " packages/api/src/index.ts
```
Expected: `export async function createServer(port = 17891)`

**Step 3: Commit**

```bash
git add packages/api/src/index.ts
git commit -m "change default API port to 17891"
```

---

### Task 2: Update dashboard to use port 17891 by default

**Files:**
- Modify: `packages/dashboard/src/lib/apollo.ts`
- Modify: `packages/dashboard/src/components/GoalDetail.tsx`
- Modify: `packages/dashboard/src/pages/ProjectList.tsx`

**Step 1: Update apollo.ts default port**

In `packages/dashboard/src/lib/apollo.ts`, change line 6:
```typescript
// From:
const apiPort = (import.meta as any).env?.VITE_API_PORT || "4000";

// To:
const apiPort = (import.meta as any).env?.VITE_API_PORT || "17891";
```

**Step 2: Fix hardcoded localhost:4000 in GoalDetail.tsx**

In `packages/dashboard/src/components/GoalDetail.tsx`, there are two hardcoded `localhost:4000` references. Replace both with the env-aware value.

Add at the top of the file (after imports):
```typescript
const apiBase = `http://localhost:${(import.meta as any).env?.VITE_API_PORT || "17891"}`;
```

Then replace:
- Line ~291: `http://localhost:4000/api/projects/...` → `` `${apiBase}/api/projects/...` ``
- Line ~652: `http://localhost:4000/api/screenshots/...` → `` `${apiBase}/api/screenshots/...` ``

**Step 3: Fix mention in ProjectList.tsx**

In `packages/dashboard/src/pages/ProjectList.tsx` around line 99, find the text mentioning `localhost:4000` and update it to `localhost:17891`.

**Step 4: Verify**

```bash
grep -r "localhost:4000" packages/dashboard/src/
```
Expected: no output.

**Step 5: Commit**

```bash
git add packages/dashboard/src/
git commit -m "update dashboard to use port 17891 by default"
```

---

### Task 3: Add static file serving to API server

The API server needs to serve the pre-built dashboard from `dist/public/` relative to its own location. This path works both in development (after copying) and when installed globally via npm.

**Files:**
- Modify: `packages/api/src/index.ts`

**Step 1: Add static file serving**

In `packages/api/src/index.ts`, add these imports at the top:
```typescript
import { fileURLToPath } from "url";
import { existsSync } from "fs";
```

Then inside `createServer`, after `app.use(cors())` and BEFORE the GraphQL middleware, add:
```typescript
// Serve pre-built dashboard if available
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dashboardPath = join(__dirname, "public");
if (existsSync(dashboardPath)) {
  app.use(express.static(dashboardPath));
}
```

And at the very end of the route definitions (after `/health`, before `return`), add the SPA fallback:
```typescript
// SPA fallback — serve index.html for all unmatched GET routes
if (existsSync(dashboardPath)) {
  app.get("*", (_, res) => {
    res.sendFile(join(dashboardPath, "index.html"));
  });
}
```

**Step 2: Verify the file compiles**

```bash
cd packages/api && npx tsc --noEmit
```
Expected: no errors.

**Step 3: Commit**

```bash
git add packages/api/src/index.ts
git commit -m "add static dashboard serving to API server"
```

---

### Task 4: Add `autogoals start` server command to CLI

The existing `start` command runs the agent on a project path (terminal mode). Rename it to `agent`, then add a new `start` command that starts the unified web server.

**Files:**
- Modify: `packages/cli/src/commands.ts`

**Step 1: Rename existing `start` command to `agent`**

In `packages/cli/src/commands.ts`, find:
```typescript
program
  .command("start")
  .description("Start the agent on a project directory")
```

Change to:
```typescript
program
  .command("agent")
  .description("Start the agent on a project directory (terminal mode)")
```

**Step 2: Add new `start` command**

Add this new command to `createProgram()`, before the `return program` line:

```typescript
program
  .command("start")
  .description("Start the AutoGoals server and dashboard on port 17891")
  .option("-p, --port <port>", "Port to listen on", "17891")
  .action(async (opts) => {
    const { createServer } = await import("@autogoals/api");
    const port = parseInt(opts.port);
    const server = await createServer(port);
    await server.start();
    console.log(`\nAutoGoals running at http://localhost:${port}`);
    console.log("Press Ctrl+C to stop.\n");

    process.on("SIGINT", async () => {
      await server.stop();
      process.exit(0);
    });
    process.on("SIGTERM", async () => {
      await server.stop();
      process.exit(0);
    });
  });
```

**Step 3: Add `@autogoals/api` to CLI's dependencies**

In `packages/cli/package.json`, add to `dependencies`:
```json
"@autogoals/api": "*"
```

**Step 4: Verify TypeScript compiles**

```bash
cd packages/cli && npx tsc --noEmit
```
Expected: no errors.

**Step 5: Test locally**

```bash
cd packages/cli && npx tsx src/index.ts start
```
Expected: `AutoGoals running at http://localhost:17891` and opening `http://localhost:17891` in a browser shows the dashboard.

**Step 6: Commit**

```bash
git add packages/cli/src/commands.ts packages/cli/package.json
git commit -m "add autogoals start command for unified server"
```

---

### Task 5: Rename CLI package to `autogoals` and add files field

**Files:**
- Modify: `packages/cli/package.json`

**Step 1: Update package.json**

Change `"name": "@autogoals/cli"` to `"name": "autogoals"` and add `"files"`:

```json
{
  "name": "autogoals",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "files": [
    "dist/"
  ],
  "bin": {
    "autogoals": "dist/index.js"
  },
  ...
}
```

**Step 2: Commit**

```bash
git add packages/cli/package.json
git commit -m "rename CLI package to autogoals, add files field"
```

---

### Task 6: Add build:publish script

This script: builds the dashboard with port 17891 baked in, copies static files into the CLI dist, then bundles everything with esbuild.

**Files:**
- Modify: `package.json` (root)

**Step 1: Install esbuild at root**

```bash
npm install --save-dev esbuild
```

**Step 2: Add build:publish script to root package.json**

```json
{
  "scripts": {
    "build:publish": "node scripts/build-publish.mjs",
    ...
  }
}
```

**Step 3: Create the build script**

Create `scripts/build-publish.mjs`:

```javascript
import { execSync } from "child_process";
import { cpSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const root = new URL("..", import.meta.url).pathname;

function run(cmd, cwd = root) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd });
}

// 1. Build core (needed for type resolution)
run("npx tsc --build", join(root, "packages/core"));

// 2. Build dashboard with port baked in
run("npx vite build", join(root, "packages/dashboard"), {
  env: { ...process.env, VITE_API_PORT: "17891" }
});

// 3. Copy dashboard dist into CLI dist/public
const dashSrc = join(root, "packages/dashboard/dist");
const dashDest = join(root, "packages/cli/dist/public");
rmSync(dashDest, { recursive: true, force: true });
mkdirSync(dashDest, { recursive: true });
cpSync(dashSrc, dashDest, { recursive: true });
console.log("Copied dashboard to packages/cli/dist/public");

// 4. Bundle CLI + API + core with esbuild
run(
  [
    "npx esbuild packages/cli/src/index.ts",
    "--bundle",
    "--platform=node",
    "--format=esm",
    "--outfile=packages/cli/dist/index.js",
    "--external:better-sqlite3",
    "--external:fsevents",
    '--banner:js="#!/usr/bin/env node"',
  ].join(" ")
);

console.log("\nBuild complete. To publish:");
console.log("  cd packages/cli && npm publish");
```

Note: fix the `run` call for dashboard — it needs to pass env differently:

```javascript
function run(cmd, cwd = root, opts = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd, ...opts });
}
```

**Step 4: Test the build**

```bash
npm run build:publish
```

Expected:
- `packages/dashboard/dist/` is populated
- `packages/cli/dist/public/` contains the dashboard files
- `packages/cli/dist/index.js` is a bundled single file

**Step 5: Test the built output**

```bash
node packages/cli/dist/index.js start
```
Expected: `AutoGoals running at http://localhost:17891` and the dashboard loads at that URL.

**Step 6: Commit**

```bash
git add package.json scripts/build-publish.mjs packages/cli/dist/ packages/dashboard/dist/
git commit -m "add build:publish script for npm release"
```

---

### Task 7: Update README

**Files:**
- Modify: `README.md`

**Step 1: Update Prerequisites and Install & Run sections**

Replace the current Prerequisites + Install & Run content:

```markdown
### Prerequisites
- Node.js 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated

### Install

```bash
npm install -g autogoals
```

### Run

```bash
autogoals start
```

Open [http://localhost:17891](http://localhost:17891).
```

**Step 2: Add a Development section for contributors**

After the main Install & Run, add:

```markdown
### Development (contributing)

```bash
git clone https://github.com/ozankasikci/autogoals.git
cd autogoals
npm install

# Terminal 1: API server
npm run dev:api

# Terminal 2: Dashboard
npm run dev:dashboard
```
```

**Step 3: Commit**

```bash
git add README.md
git commit -m "update README with global install instructions"
```

---

### Task 8: Push and update PR

```bash
git push
```

The existing PR (`migrate-pnpm-to-npm`) will receive all these commits. Verify it's up to date on GitHub.

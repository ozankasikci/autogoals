# Monorepo Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure small-singularity from a flat project into a pnpm monorepo with `packages/core` and `packages/cli`, then migrate the database to a central location with project_id scoping.

**Architecture:** Move shared code (types, state, sdk, goals, logging, config) into `@small-singularity/core`. Move CLI-specific code (phases, commands, output, entry point) into `@small-singularity/cli` which depends on core. Migrate the per-project SQLite DB to a single central DB at `~/.small-singularity/db.sqlite` with a `projects` table and `project_id` on all existing tables.

**Tech Stack:** pnpm workspaces, TypeScript project references, better-sqlite3, vitest

---

## Task 1: Initialize pnpm workspace

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root — replace existing)
- Create: `tsconfig.base.json`
- Delete: `tsconfig.json` (replaced by base)

**Step 1: Install pnpm if needed**

```bash
npm install -g pnpm
```

**Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
```

**Step 3: Create root package.json**

```json
{
  "name": "small-singularity",
  "private": true,
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "dev:cli": "pnpm --filter @small-singularity/cli dev"
  },
  "engines": {
    "node": ">=18"
  }
}
```

**Step 4: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "declarationMap": true
  }
}
```

**Step 5: Create packages directories**

```bash
mkdir -p packages/core/src packages/cli/src
```

**Step 6: Commit**

```bash
git add pnpm-workspace.yaml package.json tsconfig.base.json
git commit -m "initialize pnpm workspace structure"
```

---

## Task 2: Create @small-singularity/core package

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Move: `src/core/` → `packages/core/src/core/`
- Move: `src/modules/state/` → `packages/core/src/state/`
- Move: `src/modules/goals/` → `packages/core/src/goals/`
- Move: `src/modules/logging/` → `packages/core/src/logging/`
- Move: `src/sdk/` → `packages/core/src/sdk/`
- Move: `src/config/` → `packages/core/src/config/`
- Create: `packages/core/src/index.ts` (barrel export)

**Step 1: Create packages/core/package.json**

```json
{
  "name": "@small-singularity/core",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.2.77",
    "better-sqlite3": "^12.8.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^25.5.0",
    "typescript": "^5.9.3",
    "vitest": "^4.1.0"
  }
}
```

**Step 2: Create packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Move files**

```bash
# Move shared modules into core package
cp -r src/core/* packages/core/src/core/
cp -r src/modules/state/* packages/core/src/state/
cp -r src/modules/goals/* packages/core/src/goals/
cp -r src/modules/logging/* packages/core/src/logging/
cp -r src/sdk/* packages/core/src/sdk/
cp -r src/config/* packages/core/src/config/
```

**Step 4: Fix all import paths in core**

All imports within core need to be updated since the directory structure is flatter:
- `../../core/types.js` → `../core/types.js` (from state/, goals/, logging/, sdk/, config/)
- `../modules/logging/index.js` → `../logging/index.js` (from sdk/)
- `../modules/state/index.js` → `../state/index.js` (from core/)
- etc.

Go through every .ts file in packages/core/src/ and fix relative imports.

**Step 5: Create packages/core/src/index.ts barrel**

```typescript
// Core types
export type {
  PhaseName,
  PhaseResult,
  Phase,
  BudgetConfig,
  AgentConfig,
  Spec,
  SpecGoal,
  GoalStatus,
  GoalState,
  ProjectState,
  AgentContext,
} from "./core/types.js";

// State
export { createStore } from "./state/store.js";
export { SQLiteStore } from "./state/sqlite-store.js";
export { SCHEMA_SQL } from "./state/migrations.js";
export type { StateStore } from "./state/types.js";

// Goals
export { GoalTracker } from "./goals/tracker.js";

// Logging
export { createLogger, createSpinner } from "./logging/index.js";
export { defaultFilter } from "./logging/filters.js";
export { formatForTerminal } from "./logging/formatters.js";
export type { Logger, Spinner } from "./logging/index.js";
export type { LogEvent, LogEventType, LogFilter, LogSink, LoggerOptions } from "./logging/types.js";

// SDK
export { runQuery } from "./sdk/client.js";
export type { QueryOptions, QueryCallbacks } from "./sdk/client.js";
export {
  extractSessionId,
  extractResult,
  extractAssistantText,
  extractToolUse,
} from "./sdk/message-handler.js";
export type { SDKResult, ToolUseInfo } from "./sdk/message-handler.js";
export {
  ALL_TOOLS,
  INTERVIEW_TOOLS,
  SPEC_TOOLS,
  EXECUTION_TOOLS,
  STANDBY_TOOLS,
} from "./sdk/tool-config.js";

// Config
export { loadConfig } from "./config/loader.js";
export { DEFAULT_CONFIG } from "./config/defaults.js";
export type { ConfigInput } from "./config/types.js";
```

**Step 6: Create vitest.config.ts for core**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globals: true,
  },
});
```

**Step 7: Move core tests**

```bash
mkdir -p packages/core/tests/unit/{core,state,goals,logging,sdk,config}
cp tests/unit/core/* packages/core/tests/unit/core/
cp tests/unit/modules/state/* packages/core/tests/unit/state/
cp tests/unit/modules/goals/* packages/core/tests/unit/goals/
cp tests/unit/modules/logging/* packages/core/tests/unit/logging/
cp tests/unit/sdk/* packages/core/tests/unit/sdk/
cp tests/unit/config/* packages/core/tests/unit/config/
```

Fix test import paths to match new structure.

**Step 8: Install deps and verify**

```bash
cd packages/core && pnpm install
pnpm run test
npx tsc --noEmit
```

**Step 9: Commit**

```bash
git add packages/core/
git commit -m "create @small-singularity/core package with shared modules"
```

---

## Task 3: Create @small-singularity/cli package

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Move: `src/cli/` → `packages/cli/src/`
- Move: `src/modules/interview/` → `packages/cli/src/phases/interview/`
- Move: `src/modules/spec/` → `packages/cli/src/phases/spec/`
- Move: `src/modules/execution/` → `packages/cli/src/phases/execution/`
- Move: `src/modules/standby/` → `packages/cli/src/phases/standby/`
- Move: `src/index.ts` → `packages/cli/src/index.ts`
- Move: agent.ts and session.ts to cli since they're orchestration

**Step 1: Create packages/cli/package.json**

```json
{
  "name": "@small-singularity/cli",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "small-singularity": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@small-singularity/core": "workspace:*",
    "commander": "^14.0.3",
    "chalk": "^5.6.2"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3",
    "vitest": "^4.1.0"
  }
}
```

**Step 2: Create packages/cli/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Move files**

```bash
mkdir -p packages/cli/src/phases
cp src/cli/commands.ts packages/cli/src/commands.ts
cp src/cli/output.ts packages/cli/src/output.ts
cp src/index.ts packages/cli/src/index.ts
cp src/core/agent.ts packages/cli/src/agent.ts
cp src/core/session.ts packages/cli/src/session.ts
cp -r src/modules/interview packages/cli/src/phases/interview
cp -r src/modules/spec packages/cli/src/phases/spec
cp -r src/modules/execution packages/cli/src/phases/execution
cp -r src/modules/standby packages/cli/src/phases/standby
```

**Step 4: Fix all imports in CLI package**

All phase files and CLI files should import from `@small-singularity/core` instead of relative paths:

```typescript
// Before (in a phase file):
import type { Phase, PhaseResult, AgentContext } from "../../core/types.js";
import { runQuery } from "../../sdk/index.js";
import { INTERVIEW_TOOLS } from "../../sdk/index.js";

// After:
import type { Phase, PhaseResult, AgentContext } from "@small-singularity/core";
import { runQuery, INTERVIEW_TOOLS } from "@small-singularity/core";
```

Do this for every .ts file in packages/cli/src/.

Also update agent.ts to import Phase, Logger etc from core.
Also update commands.ts to import from core.

**Step 5: Move CLI tests**

```bash
mkdir -p packages/cli/tests/unit/{cli,phases}
cp tests/unit/cli/* packages/cli/tests/unit/cli/
cp -r tests/unit/modules/interview packages/cli/tests/unit/phases/interview
cp -r tests/unit/modules/spec packages/cli/tests/unit/phases/spec
cp -r tests/unit/modules/execution packages/cli/tests/unit/phases/execution
cp -r tests/unit/modules/standby packages/cli/tests/unit/phases/standby
cp tests/integration/* packages/cli/tests/unit/  # integration tests move here too
```

Fix test import paths.

**Step 6: Create vitest.config.ts for cli**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globals: true,
  },
});
```

**Step 7: Install deps and verify**

```bash
cd /Users/ozan/Projects/small-singularity
pnpm install
pnpm --filter @small-singularity/cli test
pnpm --filter @small-singularity/cli exec tsc --noEmit
```

**Step 8: Commit**

```bash
git add packages/cli/
git commit -m "create @small-singularity/cli package with phases and commands"
```

---

## Task 4: Clean up old src/ and root files

**Files:**
- Delete: `src/` (all moved to packages)
- Delete: `tests/` (all moved to packages)
- Delete: old `tsconfig.json`
- Delete: old `vitest.config.ts`
- Update: root `package.json` (already done in Task 1)
- Update: `.gitignore`

**Step 1: Remove old source**

```bash
rm -rf src/ tests/
rm -f tsconfig.json vitest.config.ts
```

**Step 2: Update .gitignore**

Add `dist/` entries for packages:

```
node_modules/
dist/
specs/
logs/
*.tgz
.DS_Store
tests/test-projects/
x-clone/
.small-singularity/
```

**Step 3: Verify everything from root**

```bash
pnpm install
pnpm run build
pnpm run test
```

All tests should pass from root.

**Step 4: Commit**

```bash
git add -A
git commit -m "remove old src/ and tests/, complete monorepo migration"
```

---

## Task 5: Migrate to central database with project_id scoping

**Files:**
- Modify: `packages/core/src/state/migrations.ts` — new schema with projects table + project_id
- Create: `packages/core/src/state/project-store.ts` — ProjectStore for CRUD on projects table
- Modify: `packages/core/src/state/sqlite-store.ts` — add project_id to all queries
- Modify: `packages/core/src/state/store.ts` — createStore now takes projectId, DB path is `~/.small-singularity/db.sqlite`
- Modify: `packages/core/src/state/types.ts` — add ProjectStore interface
- Modify: `packages/core/src/index.ts` — export ProjectStore
- Update: tests

**Step 1: Write tests for ProjectStore**

Create `packages/core/tests/unit/state/project-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../../../src/state/migrations.js";

// Test: create project, list projects, get project, delete project
// Test: duplicate path throws
// Test: delete nonexistent returns false
```

**Step 2: Update migrations.ts**

Replace schema with the new version from the design doc (projects table, project_id on all tables, foreign keys).

**Step 3: Implement ProjectStore**

```typescript
export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStore {
  createProject(name: string, path: string): ProjectRecord;
  listProjects(): ProjectRecord[];
  getProject(id: string): ProjectRecord | null;
  getProjectByPath(path: string): ProjectRecord | null;
  deleteProject(id: string): boolean;
}
```

**Step 4: Update SQLiteStore**

- Constructor takes `(db: Database.Database, projectId: string)`
- All queries get `WHERE project_id = ?`
- All inserts include `project_id`
- `upsertGoal` uses `project_id` in the composite key

**Step 5: Update createStore**

```typescript
import { homedir } from "os";

export function createStore(projectId: string): StateStore {
  const dir = join(homedir(), ".small-singularity");
  mkdirSync(dir, { recursive: true });
  const dbPath = join(dir, "db.sqlite");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);
  return new SQLiteStore(db, projectId);
}

export function createProjectStore(): ProjectStore {
  const dir = join(homedir(), ".small-singularity");
  mkdirSync(dir, { recursive: true });
  const dbPath = join(dir, "db.sqlite");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);
  return new SQLiteProjectStore(db);
}
```

**Step 6: Update CLI commands.ts**

- On `start`: look up project by path, create if not exists, then create scoped StateStore
- On `status`: look up project by path, read from scoped store

**Step 7: Update all tests**

Update existing state and goal tests to pass a projectId.

**Step 8: Verify**

```bash
pnpm run build
pnpm run test
```

**Step 9: Commit**

```bash
git add -A
git commit -m "migrate to central database with project_id scoping"
```

---

## Summary

| Task | What | Packages Affected |
|------|------|-------------------|
| 1 | pnpm workspace setup | root |
| 2 | Create @small-singularity/core | core |
| 3 | Create @small-singularity/cli | cli |
| 4 | Clean up old src/ | root |
| 5 | Central DB with project_id | core, cli |

Dependencies: 1 → 2 → 3 → 4 → 5

# Small Singularity — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an autonomous project agent that interviews the user, writes a spec, executes goals, and enters standby — powered by the Claude Agent SDK (TypeScript).

**Architecture:** A phase-based agent with 4 phases (interview, spec, execution, standby). Each phase implements a common `Phase` interface. The SDK is wrapped behind `sdk/client.ts` so the rest of the app never imports `@anthropic-ai/claude-agent-sdk` directly. State is persisted to disk as JSON.

**Tech Stack:** TypeScript, Node.js 18+, `@anthropic-ai/claude-agent-sdk`, `vitest`, `commander` (CLI)

**Design spec:** `docs/plans/2026-03-18-small-singularity-design.md`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

**Step 1: Initialize package.json**

```bash
cd /Users/ozan/Projects/small-singularity
npm init -y
```

Then edit `package.json` to:

```json
{
  "name": "small-singularity",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "small-singularity": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "engines": {
    "node": ">=18"
  }
}
```

**Step 2: Install dependencies**

```bash
npm install @anthropic-ai/claude-agent-sdk commander chalk
npm install -D typescript tsx vitest @types/node
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globals: true,
  },
});
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
specs/
logs/
*.tgz
```

**Step 6: Create directory structure**

```bash
mkdir -p src/{core,modules/{interview,spec,execution,standby,goals,logging,state},sdk,cli,config}
mkdir -p tests/{unit/{core,modules/{interview,spec,execution,standby,goals,logging,state},sdk,cli,config},integration,fixtures}
mkdir -p specs logs
```

**Step 7: Verify**

```bash
npm run test
```

Expected: vitest runs, finds no tests, exits 0.

**Step 8: Commit**

```bash
git add -A
git commit -m "scaffold project structure with TypeScript, vitest, and dependencies"
```

---

## Task 2: Core Types

**Files:**
- Create: `src/core/types.ts`

**Step 1: Write the test**

Create `tests/unit/core/types.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type {
  Phase,
  PhaseResult,
  PhaseName,
  AgentContext,
  AgentConfig,
  BudgetConfig,
} from "../../../src/core/types.js";

describe("core types", () => {
  it("PhaseName includes all four phases plus done", () => {
    const names: PhaseName[] = [
      "interview",
      "spec",
      "execution",
      "standby",
      "done",
    ];
    expect(names).toHaveLength(5);
  });

  it("PhaseResult has next and optional data", () => {
    const result: PhaseResult = { next: "spec" };
    expect(result.next).toBe("spec");

    const resultWithData: PhaseResult = {
      next: "execution",
      data: { foo: "bar" },
    };
    expect(resultWithData.data).toEqual({ foo: "bar" });
  });

  it("BudgetConfig has required fields", () => {
    const budget: BudgetConfig = {
      maxPerGoal: 2.0,
      maxTotal: 20.0,
      warningThreshold: 0.8,
    };
    expect(budget.maxPerGoal).toBe(2.0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/core/types.test.ts
```

Expected: FAIL — cannot find module `../../../src/core/types.js`

**Step 3: Write the implementation**

Create `src/core/types.ts`:

```typescript
export type PhaseName = "interview" | "spec" | "execution" | "standby" | "done";

export interface PhaseResult {
  next: PhaseName;
  data?: Record<string, unknown>;
}

export interface Phase {
  name: PhaseName;
  execute(context: AgentContext): Promise<PhaseResult>;
}

export interface BudgetConfig {
  maxPerGoal: number;
  maxTotal: number;
  warningThreshold: number;
}

export interface AgentConfig {
  projectPath: string;
  model: string;
  budget: BudgetConfig;
  maxRetriesPerGoal: number;
  verbose: boolean;
}

export interface Spec {
  overview: string;
  goals: SpecGoal[];
  technicalDecisions: string[];
}

export interface SpecGoal {
  id: string;
  name: string;
  description: string;
  acceptanceCriteria: string[];
  dependsOn: string[];
}

export type GoalStatus =
  | "pending"
  | "active"
  | "verifying"
  | "done"
  | "failed"
  | "retrying"
  | "skipped";

export interface GoalState {
  id: string;
  status: GoalStatus;
  retries: number;
  costUsd: number;
  error?: string;
  sessionId?: string;
}

export interface ProjectState {
  spec: Spec | null;
  goals: GoalState[];
  totalCostUsd: number;
  currentPhase: PhaseName;
  interviewNotes: string[];
}

export interface AgentContext {
  config: AgentConfig;
  state: ProjectState;
  projectPath: string;
  spec: Spec | null;
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/core/types.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/core/types.ts tests/unit/core/types.test.ts
git commit -m "add core type definitions"
```

---

## Task 3: Config Module

**Files:**
- Create: `src/config/types.ts`
- Create: `src/config/defaults.ts`
- Create: `src/config/loader.ts`
- Create: `src/config/index.ts`

**Step 1: Write the test**

Create `tests/unit/config/loader.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { loadConfig } from "../../../src/config/index.js";
import { DEFAULT_CONFIG } from "../../../src/config/defaults.js";

describe("config loader", () => {
  it("returns defaults when no overrides given", () => {
    const config = loadConfig({ projectPath: "/tmp/test" });
    expect(config.model).toBe(DEFAULT_CONFIG.model);
    expect(config.budget.maxTotal).toBe(DEFAULT_CONFIG.budget.maxTotal);
    expect(config.projectPath).toBe("/tmp/test");
  });

  it("overrides individual fields", () => {
    const config = loadConfig({
      projectPath: "/tmp/test",
      model: "haiku",
      budget: { maxPerGoal: 5, maxTotal: 50, warningThreshold: 0.9 },
    });
    expect(config.model).toBe("haiku");
    expect(config.budget.maxTotal).toBe(50);
  });

  it("requires projectPath", () => {
    expect(() => loadConfig({} as any)).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/config/loader.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

`src/config/types.ts`:

```typescript
import type { AgentConfig, BudgetConfig } from "../core/types.js";

export interface ConfigInput {
  projectPath: string;
  model?: string;
  budget?: Partial<BudgetConfig>;
  maxRetriesPerGoal?: number;
  verbose?: boolean;
}

export type { AgentConfig };
```

`src/config/defaults.ts`:

```typescript
import type { AgentConfig } from "../core/types.js";

export const DEFAULT_CONFIG: Omit<AgentConfig, "projectPath"> = {
  model: "sonnet",
  budget: {
    maxPerGoal: 2.0,
    maxTotal: 20.0,
    warningThreshold: 0.8,
  },
  maxRetriesPerGoal: 2,
  verbose: false,
};
```

`src/config/loader.ts`:

```typescript
import type { AgentConfig } from "../core/types.js";
import type { ConfigInput } from "./types.js";
import { DEFAULT_CONFIG } from "./defaults.js";

export function loadConfig(input: ConfigInput): AgentConfig {
  if (!input.projectPath) {
    throw new Error("projectPath is required");
  }

  return {
    projectPath: input.projectPath,
    model: input.model ?? DEFAULT_CONFIG.model,
    budget: {
      ...DEFAULT_CONFIG.budget,
      ...input.budget,
    },
    maxRetriesPerGoal:
      input.maxRetriesPerGoal ?? DEFAULT_CONFIG.maxRetriesPerGoal,
    verbose: input.verbose ?? DEFAULT_CONFIG.verbose,
  };
}
```

`src/config/index.ts`:

```typescript
export { loadConfig } from "./loader.js";
export { DEFAULT_CONFIG } from "./defaults.js";
export type { ConfigInput } from "./types.js";
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/config/loader.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/config/ tests/unit/config/
git commit -m "add config module with defaults and loader"
```

---

## Task 4: State Module

**Files:**
- Create: `src/modules/state/types.ts`
- Create: `src/modules/state/store.ts`
- Create: `src/modules/state/index.ts`

**Step 1: Write the test**

Create `tests/unit/modules/state/store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  createInitialState,
  loadState,
  saveState,
} from "../../../../src/modules/state/index.js";

describe("state store", () => {
  let dir: string;

  beforeEach(() => {
    dir = join(tmpdir(), `ss-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates initial state with empty values", () => {
    const state = createInitialState();
    expect(state.spec).toBeNull();
    expect(state.goals).toEqual([]);
    expect(state.totalCostUsd).toBe(0);
    expect(state.currentPhase).toBe("interview");
    expect(state.interviewNotes).toEqual([]);
  });

  it("saves and loads state to disk", () => {
    const state = createInitialState();
    state.totalCostUsd = 1.5;
    state.currentPhase = "execution";

    saveState(dir, state);
    const loaded = loadState(dir);

    expect(loaded).not.toBeNull();
    expect(loaded!.totalCostUsd).toBe(1.5);
    expect(loaded!.currentPhase).toBe("execution");
  });

  it("returns null when no state file exists", () => {
    const loaded = loadState(dir);
    expect(loaded).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/modules/state/store.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

`src/modules/state/types.ts`:

```typescript
export type { ProjectState } from "../../core/types.js";
```

`src/modules/state/store.ts`:

```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { ProjectState } from "../../core/types.js";

const STATE_FILE = "state.json";

export function createInitialState(): ProjectState {
  return {
    spec: null,
    goals: [],
    totalCostUsd: 0,
    currentPhase: "interview",
    interviewNotes: [],
  };
}

export function saveState(specsDir: string, state: ProjectState): void {
  mkdirSync(specsDir, { recursive: true });
  const filePath = join(specsDir, STATE_FILE);
  writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
}

export function loadState(specsDir: string): ProjectState | null {
  const filePath = join(specsDir, STATE_FILE);
  if (!existsSync(filePath)) {
    return null;
  }
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as ProjectState;
}
```

`src/modules/state/index.ts`:

```typescript
export { createInitialState, saveState, loadState } from "./store.js";
export type { ProjectState } from "./types.js";
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/modules/state/store.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/modules/state/ tests/unit/modules/state/
git commit -m "add state module with create, save, and load"
```

---

## Task 5: Logging Module

**Files:**
- Create: `src/modules/logging/types.ts`
- Create: `src/modules/logging/filters.ts`
- Create: `src/modules/logging/formatters.ts`
- Create: `src/modules/logging/logger.ts`
- Create: `src/modules/logging/index.ts`

**Step 1: Write the test**

Create `tests/unit/modules/logging/logger.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { createLogger } from "../../../../src/modules/logging/index.js";
import type { LogEvent } from "../../../../src/modules/logging/types.js";

describe("logger", () => {
  it("emits events that pass the filter", () => {
    const output: LogEvent[] = [];
    const logger = createLogger({
      filter: () => true,
      sink: (event) => output.push(event),
    });

    logger.log({ type: "phase_transition", message: "Starting interview" });
    expect(output).toHaveLength(1);
    expect(output[0].message).toBe("Starting interview");
  });

  it("suppresses events that fail the filter", () => {
    const output: LogEvent[] = [];
    const logger = createLogger({
      filter: () => false,
      sink: (event) => output.push(event),
    });

    logger.log({ type: "file_read", message: "reading foo.ts" });
    expect(output).toHaveLength(0);
  });

  it("always passes phase_transition and goal events with default filter", () => {
    const output: LogEvent[] = [];
    const logger = createLogger({
      sink: (event) => output.push(event),
    });

    logger.log({ type: "phase_transition", message: "entering spec" });
    logger.log({ type: "goal_start", message: "goal 1" });
    logger.log({ type: "goal_complete", message: "goal 1 done" });
    logger.log({ type: "goal_fail", message: "goal 2 failed" });
    logger.log({ type: "file_read", message: "read foo.ts" });

    expect(output).toHaveLength(4);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/modules/logging/logger.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

`src/modules/logging/types.ts`:

```typescript
export type LogEventType =
  | "phase_transition"
  | "goal_start"
  | "goal_complete"
  | "goal_fail"
  | "goal_skip"
  | "test_run"
  | "file_created"
  | "file_edited"
  | "file_read"
  | "shell_success"
  | "shell_failure"
  | "package_install"
  | "info"
  | "warning"
  | "error";

export interface LogEvent {
  type: LogEventType;
  message: string;
  detail?: string;
  costUsd?: number;
  timestamp?: number;
}

export type LogFilter = (event: LogEvent) => boolean;
export type LogSink = (event: LogEvent) => void;

export interface LoggerOptions {
  filter?: LogFilter;
  sink: LogSink;
}
```

`src/modules/logging/filters.ts`:

```typescript
import type { LogFilter, LogEventType } from "./types.js";

const ALWAYS_SHOW: Set<LogEventType> = new Set([
  "phase_transition",
  "goal_start",
  "goal_complete",
  "goal_fail",
  "goal_skip",
  "test_run",
  "file_created",
  "package_install",
  "shell_failure",
  "warning",
  "error",
]);

const NEVER_SHOW: Set<LogEventType> = new Set([
  "file_read",
  "file_edited",
]);

export const defaultFilter: LogFilter = (event) => {
  if (ALWAYS_SHOW.has(event.type)) return true;
  if (NEVER_SHOW.has(event.type)) return false;
  return false;
};
```

`src/modules/logging/formatters.ts`:

```typescript
import type { LogEvent } from "./types.js";

const TYPE_PREFIXES: Record<string, string> = {
  phase_transition: "---",
  goal_start: " >>",
  goal_complete: " OK",
  goal_fail: "ERR",
  goal_skip: "SKP",
  test_run: "TST",
  file_created: " + ",
  package_install: "PKG",
  shell_failure: " ! ",
  warning: "WRN",
  error: "ERR",
  info: "   ",
};

export function formatForTerminal(event: LogEvent): string {
  const prefix = TYPE_PREFIXES[event.type] ?? "   ";
  const cost = event.costUsd != null ? ` ($${event.costUsd.toFixed(2)})` : "";
  return `${prefix} ${event.message}${cost}`;
}
```

`src/modules/logging/logger.ts`:

```typescript
import type { LogEvent, LoggerOptions } from "./types.js";
import { defaultFilter } from "./filters.js";

export interface Logger {
  log(event: LogEvent): void;
}

export function createLogger(options: LoggerOptions): Logger {
  const filter = options.filter ?? defaultFilter;
  const sink = options.sink;

  return {
    log(event: LogEvent) {
      event.timestamp = event.timestamp ?? Date.now();
      if (filter(event)) {
        sink(event);
      }
    },
  };
}
```

`src/modules/logging/index.ts`:

```typescript
export { createLogger } from "./logger.js";
export type { Logger } from "./logger.js";
export { defaultFilter } from "./filters.js";
export { formatForTerminal } from "./formatters.js";
export type { LogEvent, LogEventType, LogFilter, LogSink, LoggerOptions } from "./types.js";
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/modules/logging/logger.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/modules/logging/ tests/unit/modules/logging/
git commit -m "add logging module with filters, formatters, and logger"
```

---

## Task 6: Goals Module

**Files:**
- Create: `src/modules/goals/types.ts`
- Create: `src/modules/goals/tracker.ts`
- Create: `src/modules/goals/store.ts`
- Create: `src/modules/goals/index.ts`

**Step 1: Write the test**

Create `tests/unit/modules/goals/tracker.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { GoalTracker } from "../../../../src/modules/goals/index.js";
import type { SpecGoal } from "../../../../src/core/types.js";

const makeGoal = (id: string, deps: string[] = []): SpecGoal => ({
  id,
  name: `Goal ${id}`,
  description: `Description for ${id}`,
  acceptanceCriteria: [`${id} works`],
  dependsOn: deps,
});

describe("GoalTracker", () => {
  it("initializes goals from spec goals", () => {
    const tracker = new GoalTracker([makeGoal("1"), makeGoal("2")], 2);
    expect(tracker.getAll()).toHaveLength(2);
    expect(tracker.getAll()[0].status).toBe("pending");
  });

  it("returns next goal that has no unmet dependencies", () => {
    const tracker = new GoalTracker(
      [makeGoal("1"), makeGoal("2", ["1"])],
      2
    );
    const next = tracker.getNextPending();
    expect(next?.id).toBe("1");
  });

  it("transitions goal through lifecycle", () => {
    const tracker = new GoalTracker([makeGoal("1")], 2);

    tracker.start("1");
    expect(tracker.get("1")!.status).toBe("active");

    tracker.startVerifying("1");
    expect(tracker.get("1")!.status).toBe("verifying");

    tracker.complete("1", 0.5);
    expect(tracker.get("1")!.status).toBe("done");
    expect(tracker.get("1")!.costUsd).toBe(0.5);
  });

  it("retries failed goal up to max retries then skips", () => {
    const tracker = new GoalTracker([makeGoal("1")], 2);

    tracker.start("1");
    tracker.fail("1", "first error");
    expect(tracker.get("1")!.status).toBe("failed");

    tracker.retry("1");
    expect(tracker.get("1")!.status).toBe("retrying");
    expect(tracker.get("1")!.retries).toBe(1);

    tracker.start("1");
    tracker.fail("1", "second error");
    tracker.retry("1");
    expect(tracker.get("1")!.retries).toBe(2);

    tracker.start("1");
    tracker.fail("1", "third error");
    const canRetry = tracker.canRetry("1");
    expect(canRetry).toBe(false);

    tracker.skip("1");
    expect(tracker.get("1")!.status).toBe("skipped");
  });

  it("reports all done when every goal is done or skipped", () => {
    const tracker = new GoalTracker([makeGoal("1"), makeGoal("2")], 2);

    tracker.start("1");
    tracker.startVerifying("1");
    tracker.complete("1", 0.3);

    tracker.skip("2");

    expect(tracker.isAllDone()).toBe(true);
  });

  it("computes total cost", () => {
    const tracker = new GoalTracker([makeGoal("1"), makeGoal("2")], 2);

    tracker.start("1");
    tracker.startVerifying("1");
    tracker.complete("1", 1.2);

    tracker.start("2");
    tracker.startVerifying("2");
    tracker.complete("2", 0.8);

    expect(tracker.totalCost()).toBe(2.0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/modules/goals/tracker.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

`src/modules/goals/types.ts`:

```typescript
export type { GoalState, GoalStatus, SpecGoal } from "../../core/types.js";
```

`src/modules/goals/tracker.ts`:

```typescript
import type { GoalState, GoalStatus, SpecGoal } from "../../core/types.js";

export class GoalTracker {
  private goals: Map<string, GoalState> = new Map();
  private specGoals: Map<string, SpecGoal> = new Map();
  private maxRetries: number;

  constructor(specGoals: SpecGoal[], maxRetries: number) {
    this.maxRetries = maxRetries;
    for (const sg of specGoals) {
      this.specGoals.set(sg.id, sg);
      this.goals.set(sg.id, {
        id: sg.id,
        status: "pending",
        retries: 0,
        costUsd: 0,
      });
    }
  }

  get(id: string): GoalState | undefined {
    return this.goals.get(id);
  }

  getAll(): GoalState[] {
    return Array.from(this.goals.values());
  }

  getNextPending(): GoalState | undefined {
    for (const [id, state] of this.goals) {
      if (state.status !== "pending" && state.status !== "retrying") continue;
      const spec = this.specGoals.get(id)!;
      const depsReady = spec.dependsOn.every((depId) => {
        const dep = this.goals.get(depId);
        return dep && (dep.status === "done" || dep.status === "skipped");
      });
      if (depsReady) return state;
    }
    return undefined;
  }

  start(id: string): void {
    this.setStatus(id, "active");
  }

  startVerifying(id: string): void {
    this.setStatus(id, "verifying");
  }

  complete(id: string, costUsd: number): void {
    const goal = this.mustGet(id);
    goal.status = "done";
    goal.costUsd += costUsd;
  }

  fail(id: string, error: string): void {
    const goal = this.mustGet(id);
    goal.status = "failed";
    goal.error = error;
  }

  canRetry(id: string): boolean {
    const goal = this.mustGet(id);
    return goal.retries < this.maxRetries;
  }

  retry(id: string): void {
    const goal = this.mustGet(id);
    goal.retries += 1;
    goal.status = "retrying";
  }

  skip(id: string): void {
    this.setStatus(id, "skipped");
  }

  isAllDone(): boolean {
    return this.getAll().every(
      (g) => g.status === "done" || g.status === "skipped"
    );
  }

  totalCost(): number {
    return this.getAll().reduce((sum, g) => sum + g.costUsd, 0);
  }

  private setStatus(id: string, status: GoalStatus): void {
    this.mustGet(id).status = status;
  }

  private mustGet(id: string): GoalState {
    const goal = this.goals.get(id);
    if (!goal) throw new Error(`Unknown goal: ${id}`);
    return goal;
  }
}
```

`src/modules/goals/store.ts`:

```typescript
import type { GoalState } from "../../core/types.js";
import { GoalTracker } from "./tracker.js";

export function serializeGoals(tracker: GoalTracker): GoalState[] {
  return tracker.getAll();
}
```

`src/modules/goals/index.ts`:

```typescript
export { GoalTracker } from "./tracker.js";
export { serializeGoals } from "./store.js";
export type { GoalState, GoalStatus, SpecGoal } from "./types.js";
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/modules/goals/tracker.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/modules/goals/ tests/unit/modules/goals/
git commit -m "add goals module with tracker and state machine"
```

---

## Task 7: SDK Wrapper Module

**Files:**
- Create: `src/sdk/tool-config.ts`
- Create: `src/sdk/message-handler.ts`
- Create: `src/sdk/client.ts`
- Create: `src/sdk/index.ts`

**Step 1: Write the test**

Create `tests/unit/sdk/message-handler.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  extractSessionId,
  extractResult,
  extractAssistantText,
  extractToolUse,
} from "../../../src/sdk/message-handler.js";

describe("message handler", () => {
  it("extracts session ID from init message", () => {
    const msg = { type: "system", subtype: "init", session_id: "abc-123" };
    expect(extractSessionId(msg)).toBe("abc-123");
  });

  it("returns null for non-init messages", () => {
    const msg = { type: "assistant", message: { content: [] } };
    expect(extractSessionId(msg)).toBeNull();
  });

  it("extracts result from success message", () => {
    const msg = {
      type: "result",
      subtype: "success",
      result: "done",
      total_cost_usd: 0.5,
      duration_ms: 3000,
      session_id: "abc",
    };
    const result = extractResult(msg);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("done");
    expect(result!.costUsd).toBe(0.5);
  });

  it("extracts text from assistant message", () => {
    const msg = {
      type: "assistant",
      message: {
        content: [
          { type: "text", text: "Hello" },
          { type: "tool_use", name: "Read", id: "1", input: {} },
        ],
      },
    };
    expect(extractAssistantText(msg)).toBe("Hello");
  });

  it("extracts tool use from assistant message", () => {
    const msg = {
      type: "assistant",
      message: {
        content: [
          { type: "tool_use", name: "Bash", id: "1", input: { command: "ls" } },
        ],
      },
    };
    const tools = extractToolUse(msg);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("Bash");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/sdk/message-handler.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

`src/sdk/tool-config.ts`:

```typescript
export const ALL_TOOLS = [
  "Read",
  "Write",
  "Edit",
  "Bash",
  "Glob",
  "Grep",
  "WebSearch",
  "WebFetch",
  "Agent",
  "TodoWrite",
];

export const INTERVIEW_TOOLS = ["Read", "Glob", "Grep", "WebSearch", "WebFetch"];

export const SPEC_TOOLS = ["Read", "Write", "Glob", "Grep"];

export const EXECUTION_TOOLS = [...ALL_TOOLS];

export const STANDBY_TOOLS = [...ALL_TOOLS];
```

`src/sdk/message-handler.ts`:

```typescript
export interface SDKResult {
  text: string;
  costUsd: number;
  durationMs: number;
  sessionId: string;
}

export interface ToolUseInfo {
  name: string;
  id: string;
  input: Record<string, unknown>;
}

export function extractSessionId(msg: any): string | null {
  if (msg.type === "system" && msg.subtype === "init" && msg.session_id) {
    return msg.session_id;
  }
  return null;
}

export function extractResult(msg: any): SDKResult | null {
  if (msg.type === "result") {
    return {
      text: msg.result ?? "",
      costUsd: msg.total_cost_usd ?? 0,
      durationMs: msg.duration_ms ?? 0,
      sessionId: msg.session_id ?? "",
    };
  }
  return null;
}

export function extractAssistantText(msg: any): string | null {
  if (msg.type !== "assistant" || !msg.message?.content) return null;
  const textBlocks = msg.message.content.filter(
    (block: any) => block.type === "text"
  );
  if (textBlocks.length === 0) return null;
  return textBlocks.map((b: any) => b.text).join("");
}

export function extractToolUse(msg: any): ToolUseInfo[] {
  if (msg.type !== "assistant" || !msg.message?.content) return [];
  return msg.message.content
    .filter((block: any) => block.type === "tool_use")
    .map((block: any) => ({
      name: block.name,
      id: block.id,
      input: block.input ?? {},
    }));
}
```

`src/sdk/client.ts`:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKResult } from "./message-handler.js";
import {
  extractSessionId,
  extractResult,
  extractAssistantText,
  extractToolUse,
} from "./message-handler.js";
import type { Logger } from "../modules/logging/logger.js";
import type { LogEvent } from "../modules/logging/types.js";

export interface QueryOptions {
  prompt: string;
  systemPrompt?: string;
  allowedTools?: string[];
  cwd?: string;
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  resume?: string;
  permissionMode?: string;
}

export interface QueryCallbacks {
  onSessionId?: (id: string) => void;
  onAssistantText?: (text: string) => void;
  onToolUse?: (name: string, input: Record<string, unknown>) => void;
}

export async function runQuery(
  options: QueryOptions,
  logger?: Logger,
  callbacks?: QueryCallbacks,
): Promise<SDKResult | null> {
  let lastResult: SDKResult | null = null;

  for await (const message of query({
    prompt: options.prompt,
    options: {
      systemPrompt: options.systemPrompt,
      allowedTools: options.allowedTools,
      cwd: options.cwd,
      model: options.model,
      maxTurns: options.maxTurns,
      maxBudgetUsd: options.maxBudgetUsd,
      resume: options.resume,
      permissionMode: options.permissionMode ?? "bypassPermissions",
    },
  })) {
    const sessionId = extractSessionId(message);
    if (sessionId) {
      callbacks?.onSessionId?.(sessionId);
    }

    const text = extractAssistantText(message);
    if (text) {
      callbacks?.onAssistantText?.(text);
    }

    const tools = extractToolUse(message);
    for (const tool of tools) {
      callbacks?.onToolUse?.(tool.name, tool.input);

      if (logger) {
        const event = toolUseToLogEvent(tool.name, tool.input);
        if (event) logger.log(event);
      }
    }

    const result = extractResult(message);
    if (result) {
      lastResult = result;
    }
  }

  return lastResult;
}

function toolUseToLogEvent(
  name: string,
  input: Record<string, unknown>
): LogEvent | null {
  switch (name) {
    case "Write":
      return {
        type: "file_created",
        message: `Created ${input.file_path ?? "file"}`,
      };
    case "Edit":
      return {
        type: "file_edited",
        message: `Edited ${input.file_path ?? "file"}`,
      };
    case "Read":
      return {
        type: "file_read",
        message: `Read ${input.file_path ?? "file"}`,
      };
    case "Bash":
      return {
        type: "shell_success",
        message: `$ ${String(input.command ?? "").slice(0, 80)}`,
      };
    default:
      return null;
  }
}
```

`src/sdk/index.ts`:

```typescript
export { runQuery } from "./client.js";
export type { QueryOptions, QueryCallbacks } from "./client.js";
export {
  extractSessionId,
  extractResult,
  extractAssistantText,
  extractToolUse,
} from "./message-handler.js";
export type { SDKResult, ToolUseInfo } from "./message-handler.js";
export {
  ALL_TOOLS,
  INTERVIEW_TOOLS,
  SPEC_TOOLS,
  EXECUTION_TOOLS,
  STANDBY_TOOLS,
} from "./tool-config.js";
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/sdk/message-handler.test.ts
```

Expected: PASS (message-handler has no SDK dependency, so it's fully testable)

**Step 5: Commit**

```bash
git add src/sdk/ tests/unit/sdk/
git commit -m "add SDK wrapper module with client, message handler, and tool config"
```

---

## Task 8: Phase Interface & Agent Orchestrator

**Files:**
- Create: `src/modules/interview/types.ts`
- Create: `src/modules/spec/types.ts`
- Create: `src/modules/execution/types.ts`
- Create: `src/modules/standby/types.ts`
- Create: `src/core/agent.ts`
- Create: `src/core/session.ts`

**Step 1: Write the test**

Create `tests/unit/core/agent.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { Agent } from "../../../src/core/agent.js";
import type { Phase, PhaseResult, AgentContext } from "../../../src/core/types.js";
import { createInitialState } from "../../../src/modules/state/index.js";
import { loadConfig } from "../../../src/config/index.js";
import { createLogger } from "../../../src/modules/logging/index.js";

function mockPhase(name: string, next: string): Phase {
  return {
    name: name as any,
    execute: vi.fn().mockResolvedValue({ next } as PhaseResult),
  };
}

describe("Agent", () => {
  it("transitions through phases until done", async () => {
    const interview = mockPhase("interview", "spec");
    const spec = mockPhase("spec", "execution");
    const execution = mockPhase("execution", "standby");
    const standby = mockPhase("standby", "done");

    const agent = new Agent({
      interview,
      spec,
      execution,
      standby,
    });

    const config = loadConfig({ projectPath: "/tmp/test" });
    const state = createInitialState();
    const logger = createLogger({ sink: () => {} });

    await agent.run({
      config,
      state,
      projectPath: "/tmp/test",
      spec: null,
    }, logger);

    expect(interview.execute).toHaveBeenCalledOnce();
    expect(spec.execute).toHaveBeenCalledOnce();
    expect(execution.execute).toHaveBeenCalledOnce();
    expect(standby.execute).toHaveBeenCalledOnce();
  });

  it("can skip phases based on phase result", async () => {
    const interview = mockPhase("interview", "execution");
    const spec = mockPhase("spec", "done");
    const execution = mockPhase("execution", "done");
    const standby = mockPhase("standby", "done");

    const agent = new Agent({ interview, spec, execution, standby });

    const config = loadConfig({ projectPath: "/tmp/test" });
    const state = createInitialState();
    const logger = createLogger({ sink: () => {} });

    await agent.run({
      config,
      state,
      projectPath: "/tmp/test",
      spec: null,
    }, logger);

    expect(interview.execute).toHaveBeenCalledOnce();
    expect(spec.execute).not.toHaveBeenCalled();
    expect(execution.execute).toHaveBeenCalledOnce();
    expect(standby.execute).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/core/agent.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

`src/modules/interview/types.ts`:

```typescript
export interface InterviewResult {
  notes: string[];
  rawTranscript: string;
}
```

`src/modules/spec/types.ts`:

```typescript
import type { Spec } from "../../core/types.js";

export interface SpecPhaseResult {
  spec: Spec;
  specPath: string;
}
```

`src/modules/execution/types.ts`:

```typescript
export interface ExecutionSummary {
  completed: string[];
  failed: string[];
  skipped: string[];
  totalCostUsd: number;
}
```

`src/modules/standby/types.ts`:

```typescript
export interface StandbyCommand {
  type: "new_goal" | "question" | "change" | "quit";
  content: string;
}
```

`src/core/session.ts`:

```typescript
export interface SessionInfo {
  sessionId: string | null;
  phase: string;
}

export class SessionManager {
  private sessions: Map<string, string> = new Map();

  setSessionId(phase: string, sessionId: string): void {
    this.sessions.set(phase, sessionId);
  }

  getSessionId(phase: string): string | undefined {
    return this.sessions.get(phase);
  }

  getAllSessions(): Record<string, string> {
    return Object.fromEntries(this.sessions);
  }
}
```

`src/core/agent.ts`:

```typescript
import type { Phase, PhaseName, AgentContext } from "./types.js";
import type { Logger } from "../modules/logging/logger.js";

export interface PhaseMap {
  interview: Phase;
  spec: Phase;
  execution: Phase;
  standby: Phase;
}

export class Agent {
  private phases: PhaseMap;

  constructor(phases: PhaseMap) {
    this.phases = phases;
  }

  async run(context: AgentContext, logger: Logger): Promise<void> {
    let currentPhase: PhaseName = "interview";

    while (currentPhase !== "done") {
      const phase = this.phases[currentPhase as keyof PhaseMap];
      if (!phase) {
        throw new Error(`Unknown phase: ${currentPhase}`);
      }

      logger.log({
        type: "phase_transition",
        message: `Entering ${currentPhase} phase`,
      });

      context.state.currentPhase = currentPhase;
      const result = await phase.execute(context);
      currentPhase = result.next;
    }

    logger.log({
      type: "phase_transition",
      message: "All phases complete",
    });
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/core/agent.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/core/ src/modules/interview/types.ts src/modules/spec/types.ts src/modules/execution/types.ts src/modules/standby/types.ts tests/unit/core/agent.test.ts
git commit -m "add agent orchestrator with phase transitions and session manager"
```

---

## Task 9: Interview Phase

**Files:**
- Create: `src/modules/interview/interview.phase.ts`
- Create: `src/modules/interview/question-builder.ts`
- Create: `src/modules/interview/index.ts`

**Step 1: Write the test**

Create `tests/unit/modules/interview/interview.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { buildInterviewPrompt } from "../../../../src/modules/interview/question-builder.js";

describe("interview question builder", () => {
  it("includes project scan instruction for new projects", () => {
    const prompt = buildInterviewPrompt({ existingFiles: [], userDescription: "build a todo app" });
    expect(prompt).toContain("todo app");
    expect(prompt).toContain("one question at a time");
  });

  it("includes existing file context for existing projects", () => {
    const prompt = buildInterviewPrompt({
      existingFiles: ["package.json", "src/index.ts"],
      userDescription: "add auth",
    });
    expect(prompt).toContain("package.json");
    expect(prompt).toContain("add auth");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/modules/interview/interview.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

`src/modules/interview/question-builder.ts`:

```typescript
export interface InterviewPromptInput {
  existingFiles: string[];
  userDescription: string;
}

export function buildInterviewPrompt(input: InterviewPromptInput): string {
  const fileContext =
    input.existingFiles.length > 0
      ? `The project already contains these files:\n${input.existingFiles.map((f) => `- ${f}`).join("\n")}\n\nScan these files to understand the current state before asking questions.`
      : "This is a new/empty project.";

  return `You are an expert project planner conducting an interview to gather requirements.

The user wants: ${input.userDescription}

${fileContext}

Your job:
- Ask questions one at a time to fully understand what needs to be built
- Prefer multiple-choice questions when possible
- Cover: scope, constraints, tech preferences, success criteria, edge cases
- When you feel you have enough information, respond with exactly: "INTERVIEW_COMPLETE"
- Include a summary of all gathered requirements when you say INTERVIEW_COMPLETE

Do NOT write any code. Do NOT start building. Only gather information.
Ask your first question now.`;
}
```

`src/modules/interview/interview.phase.ts`:

```typescript
import type { Phase, PhaseResult, AgentContext } from "../../core/types.js";
import { runQuery } from "../../sdk/index.js";
import { INTERVIEW_TOOLS } from "../../sdk/tool-config.js";
import { buildInterviewPrompt } from "./question-builder.js";
import type { InterviewResult } from "./types.js";
import * as readline from "readline";

export class InterviewPhase implements Phase {
  name = "interview" as const;

  async execute(context: AgentContext): Promise<PhaseResult> {
    const { config, projectPath } = context;

    // Scan existing files
    const existingFiles = await this.scanProject(projectPath);

    // Get initial description from user
    const description = await this.askUser(
      "What do you want to build or change? Describe it in your own words:\n> "
    );

    const systemPrompt = buildInterviewPrompt({
      existingFiles,
      userDescription: description,
    });

    const notes: string[] = [description];
    let sessionId: string | undefined;
    let interviewDone = false;

    // Multi-turn interview loop
    let currentPrompt = systemPrompt;
    let isFirstTurn = true;

    while (!interviewDone) {
      const result = await runQuery(
        {
          prompt: isFirstTurn ? "Begin the interview." : currentPrompt,
          systemPrompt: isFirstTurn ? systemPrompt : undefined,
          allowedTools: INTERVIEW_TOOLS,
          cwd: projectPath,
          model: config.model,
          maxTurns: 10,
          resume: sessionId,
        },
        undefined,
        {
          onSessionId: (id) => {
            sessionId = id;
          },
          onAssistantText: (text) => {
            if (text.includes("INTERVIEW_COMPLETE")) {
              interviewDone = true;
              notes.push(text);
            }
          },
        }
      );

      isFirstTurn = false;

      if (interviewDone) break;

      // Get the assistant's last text (the question)
      const assistantText = result?.text ?? "";
      if (assistantText) {
        console.log(`\n${assistantText}`);
      }

      // Get user's answer
      const answer = await this.askUser("> ");
      notes.push(answer);
      currentPrompt = answer;
    }

    context.state.interviewNotes = notes;

    return {
      next: "spec",
      data: {
        notes,
        rawTranscript: notes.join("\n\n"),
      } satisfies InterviewResult as unknown as Record<string, unknown>,
    };
  }

  private async scanProject(projectPath: string): Promise<string[]> {
    const { readdirSync, statSync } = await import("fs");
    const { join, relative } = await import("path");

    const files: string[] = [];
    const scan = (dir: string, depth: number) => {
      if (depth > 3) return;
      try {
        for (const entry of readdirSync(dir)) {
          if (entry.startsWith(".") || entry === "node_modules") continue;
          const full = join(dir, entry);
          const stat = statSync(full);
          if (stat.isDirectory()) {
            scan(full, depth + 1);
          } else {
            files.push(relative(projectPath, full));
          }
        }
      } catch {
        // ignore permission errors
      }
    };
    scan(projectPath, 0);
    return files;
  }

  private askUser(prompt: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }
}
```

`src/modules/interview/index.ts`:

```typescript
export { InterviewPhase } from "./interview.phase.js";
export { buildInterviewPrompt } from "./question-builder.js";
export type { InterviewResult } from "./types.js";
export type { InterviewPromptInput } from "./question-builder.js";
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/modules/interview/interview.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/modules/interview/ tests/unit/modules/interview/
git commit -m "add interview phase with question builder and multi-turn loop"
```

---

## Task 10: Spec Phase

**Files:**
- Create: `src/modules/spec/spec-writer.ts`
- Create: `src/modules/spec/spec-parser.ts`
- Create: `src/modules/spec/spec.phase.ts`
- Create: `src/modules/spec/index.ts`

**Step 1: Write the test**

Create `tests/unit/modules/spec/spec-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseSpec, renderSpec } from "../../../../src/modules/spec/index.js";
import type { Spec } from "../../../../src/core/types.js";

const sampleSpec: Spec = {
  overview: "A todo app with auth",
  goals: [
    {
      id: "1",
      name: "Set up project",
      description: "Initialize Next.js with TypeScript",
      acceptanceCriteria: ["npm run dev starts successfully"],
      dependsOn: [],
    },
    {
      id: "2",
      name: "Add auth",
      description: "Set up NextAuth with GitHub OAuth",
      acceptanceCriteria: ["Users can sign in", "Users can sign out"],
      dependsOn: ["1"],
    },
  ],
  technicalDecisions: ["Next.js 14", "NextAuth", "Prisma"],
};

describe("spec parser", () => {
  it("renders a spec to markdown", () => {
    const md = renderSpec(sampleSpec);
    expect(md).toContain("# Project Spec");
    expect(md).toContain("A todo app with auth");
    expect(md).toContain("Set up project");
    expect(md).toContain("Add auth");
    expect(md).toContain("npm run dev starts successfully");
    expect(md).toContain("Next.js 14");
  });

  it("parses a rendered spec back to object", () => {
    const md = renderSpec(sampleSpec);
    const parsed = parseSpec(md);
    expect(parsed.overview).toContain("todo app");
    expect(parsed.goals).toHaveLength(2);
    expect(parsed.goals[0].name).toBe("Set up project");
    expect(parsed.goals[1].dependsOn).toContain("1");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/modules/spec/spec-parser.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

`src/modules/spec/spec-writer.ts`:

```typescript
import type { Spec, SpecGoal } from "../../core/types.js";

export function renderSpec(spec: Spec): string {
  const lines: string[] = [];

  lines.push("# Project Spec");
  lines.push("");
  lines.push("## Overview");
  lines.push("");
  lines.push(spec.overview);
  lines.push("");
  lines.push("## Goals");
  lines.push("");

  for (const goal of spec.goals) {
    lines.push(`### Goal ${goal.id}: ${goal.name}`);
    lines.push("");
    lines.push(goal.description);
    lines.push("");
    lines.push("**Acceptance Criteria:**");
    for (const criterion of goal.acceptanceCriteria) {
      lines.push(`- ${criterion}`);
    }
    if (goal.dependsOn.length > 0) {
      lines.push("");
      lines.push(`**Depends on:** ${goal.dependsOn.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("## Technical Decisions");
  lines.push("");
  for (const decision of spec.technicalDecisions) {
    lines.push(`- ${decision}`);
  }
  lines.push("");

  return lines.join("\n");
}
```

`src/modules/spec/spec-parser.ts`:

```typescript
import type { Spec, SpecGoal } from "../../core/types.js";

export function parseSpec(markdown: string): Spec {
  const overview = extractSection(markdown, "## Overview", "##") ?? "";
  const goalsSection = extractSection(markdown, "## Goals", "## Technical") ?? "";
  const techSection = extractSection(markdown, "## Technical Decisions", null) ?? "";

  const goals = parseGoals(goalsSection);
  const technicalDecisions = techSection
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());

  return { overview: overview.trim(), goals, technicalDecisions };
}

function extractSection(
  markdown: string,
  startMarker: string,
  endMarker: string | null
): string | null {
  const startIdx = markdown.indexOf(startMarker);
  if (startIdx === -1) return null;
  const contentStart = startIdx + startMarker.length;
  if (endMarker === null) {
    return markdown.slice(contentStart);
  }
  const endIdx = markdown.indexOf(endMarker, contentStart);
  if (endIdx === -1) return markdown.slice(contentStart);
  return markdown.slice(contentStart, endIdx);
}

function parseGoals(section: string): SpecGoal[] {
  const goals: SpecGoal[] = [];
  const goalBlocks = section.split(/### Goal /);

  for (const block of goalBlocks) {
    if (!block.trim()) continue;

    const firstLine = block.split("\n")[0];
    const match = firstLine.match(/^(\S+):\s*(.+)/);
    if (!match) continue;

    const id = match[1];
    const name = match[2].trim();
    const description = extractGoalDescription(block);
    const acceptanceCriteria = extractListAfter(block, "**Acceptance Criteria:**");
    const dependsOn = extractDependsOn(block);

    goals.push({ id, name, description, acceptanceCriteria, dependsOn });
  }

  return goals;
}

function extractGoalDescription(block: string): string {
  const lines = block.split("\n").slice(1);
  const descLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("**")) break;
    if (line.trim()) descLines.push(line.trim());
  }
  return descLines.join(" ");
}

function extractListAfter(block: string, marker: string): string[] {
  const idx = block.indexOf(marker);
  if (idx === -1) return [];
  const after = block.slice(idx + marker.length);
  const items: string[] = [];
  for (const line of after.split("\n")) {
    if (line.startsWith("- ")) {
      items.push(line.slice(2).trim());
    } else if (line.startsWith("**") || (line.startsWith("###") && items.length > 0)) {
      break;
    }
  }
  return items;
}

function extractDependsOn(block: string): string[] {
  const match = block.match(/\*\*Depends on:\*\*\s*(.+)/);
  if (!match) return [];
  return match[1].split(",").map((s) => s.trim());
}
```

`src/modules/spec/spec.phase.ts`:

```typescript
import type { Phase, PhaseResult, AgentContext, Spec } from "../../core/types.js";
import { runQuery } from "../../sdk/index.js";
import { SPEC_TOOLS } from "../../sdk/tool-config.js";
import { renderSpec } from "./spec-writer.js";
import { parseSpec } from "./spec-parser.js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import * as readline from "readline";

export class SpecPhase implements Phase {
  name = "spec" as const;

  async execute(context: AgentContext): Promise<PhaseResult> {
    const { config, state, projectPath } = context;
    const notes = state.interviewNotes.join("\n\n");

    const systemPrompt = `You are an expert project architect. Based on the interview notes below, write a complete project specification.

OUTPUT FORMAT — you MUST output ONLY a markdown document in this exact format:

# Project Spec

## Overview
[1-3 sentences describing the project]

## Goals
### Goal 1: [name]
[description]
**Acceptance Criteria:**
- [criterion 1]
- [criterion 2]
**Depends on:** [comma-separated goal IDs, or omit if none]

### Goal 2: [name]
...

## Technical Decisions
- [decision 1]
- [decision 2]

INTERVIEW NOTES:
${notes}

Rules:
- Number goals sequentially starting from 1
- Each goal must have concrete, testable acceptance criteria
- Order goals by dependency (earlier goals first)
- Be specific — no vague goals like "make it work"
- Keep it concise — only what was discussed in the interview`;

    let approved = false;
    let spec: Spec | null = null;
    let specMarkdown = "";
    let sessionId: string | undefined;

    while (!approved) {
      const result = await runQuery(
        {
          prompt: sessionId
            ? "Please revise the spec based on my feedback."
            : "Write the project specification now.",
          systemPrompt: sessionId ? undefined : systemPrompt,
          allowedTools: SPEC_TOOLS,
          cwd: projectPath,
          model: config.model,
          maxTurns: 10,
          resume: sessionId,
        },
        undefined,
        {
          onSessionId: (id) => {
            sessionId = id;
          },
        }
      );

      specMarkdown = result?.text ?? "";
      console.log("\n" + specMarkdown);

      try {
        spec = parseSpec(specMarkdown);
      } catch {
        console.log("\nFailed to parse spec. Asking agent to reformat...");
        continue;
      }

      const answer = await this.askUser(
        "\nApprove this spec? (y/n/your feedback)\n> "
      );

      if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
        approved = true;
      } else {
        // Feed the feedback back as the next prompt
        const feedbackPrompt = `The user gave this feedback on the spec:\n\n${answer}\n\nPlease revise the spec accordingly. Output the full revised spec in the same format.`;
        // We'll use resume to continue the conversation
        const reviseResult = await runQuery(
          {
            prompt: feedbackPrompt,
            allowedTools: SPEC_TOOLS,
            cwd: projectPath,
            model: config.model,
            maxTurns: 10,
            resume: sessionId,
          },
          undefined,
          {
            onSessionId: (id) => {
              sessionId = id;
            },
          }
        );
        specMarkdown = reviveResult?.text ?? specMarkdown;
        console.log("\n" + specMarkdown);

        try {
          spec = parseSpec(specMarkdown);
        } catch {
          console.log("\nFailed to parse revised spec. Trying again...");
          continue;
        }

        const answer2 = await this.askUser(
          "\nApprove this revised spec? (y/n/your feedback)\n> "
        );
        if (answer2.toLowerCase() === "y" || answer2.toLowerCase() === "yes") {
          approved = true;
        }
      }
    }

    // Save spec to disk
    const specsDir = join(projectPath, "specs");
    mkdirSync(specsDir, { recursive: true });
    writeFileSync(join(specsDir, "project-spec.md"), specMarkdown, "utf-8");

    context.spec = spec;
    context.state.spec = spec;

    return {
      next: "execution",
      data: { spec, specPath: join(specsDir, "project-spec.md") },
    };
  }

  private askUser(prompt: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }
}
```

`src/modules/spec/index.ts`:

```typescript
export { SpecPhase } from "./spec.phase.js";
export { renderSpec } from "./spec-writer.js";
export { parseSpec } from "./spec-parser.js";
export type { SpecPhaseResult } from "./types.js";
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/modules/spec/spec-parser.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/modules/spec/ tests/unit/modules/spec/
git commit -m "add spec phase with writer, parser, and approval loop"
```

---

## Task 11: Execution Phase

**Files:**
- Create: `src/modules/execution/planner.ts`
- Create: `src/modules/execution/verifier.ts`
- Create: `src/modules/execution/execution.phase.ts`
- Create: `src/modules/execution/index.ts`

**Step 1: Write the test**

Create `tests/unit/modules/execution/planner.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildExecutionPrompt,
  buildVerificationPrompt,
} from "../../../../src/modules/execution/planner.js";
import type { SpecGoal } from "../../../../src/core/types.js";

const goal: SpecGoal = {
  id: "1",
  name: "Set up auth",
  description: "Add NextAuth with GitHub OAuth",
  acceptanceCriteria: ["Users can sign in", "Users can sign out"],
  dependsOn: [],
};

describe("execution planner", () => {
  it("builds execution prompt with goal details", () => {
    const prompt = buildExecutionPrompt(goal, []);
    expect(prompt).toContain("Set up auth");
    expect(prompt).toContain("NextAuth with GitHub OAuth");
    expect(prompt).toContain("Users can sign in");
  });

  it("includes completed goals as context", () => {
    const prompt = buildExecutionPrompt(goal, ["Project scaffolding done"]);
    expect(prompt).toContain("Project scaffolding done");
  });

  it("builds verification prompt", () => {
    const prompt = buildVerificationPrompt(goal);
    expect(prompt).toContain("Users can sign in");
    expect(prompt).toContain("verify");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/modules/execution/planner.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

`src/modules/execution/planner.ts`:

```typescript
import type { SpecGoal } from "../../core/types.js";

export function buildExecutionPrompt(
  goal: SpecGoal,
  completedGoalSummaries: string[]
): string {
  const context =
    completedGoalSummaries.length > 0
      ? `\n\nAlready completed:\n${completedGoalSummaries.map((s) => `- ${s}`).join("\n")}`
      : "";

  return `You are implementing a specific goal in a project. Work autonomously until the goal is complete.

## Goal: ${goal.name}

${goal.description}

## Acceptance Criteria
${goal.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}
${context}

## Rules
- Implement this goal completely
- Write tests where applicable
- Run tests to verify they pass
- Do NOT work on other goals
- When done, summarize what you built`;
}

export function buildVerificationPrompt(goal: SpecGoal): string {
  return `You are reviewing whether a goal has been properly implemented. Do NOT make changes — only verify.

## Goal: ${goal.name}

## Acceptance Criteria to verify:
${goal.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}

Check each criterion:
1. Run any existing tests
2. Review the code for each criterion
3. Try running the feature if possible

Respond with:
- VERIFIED: if all criteria are met
- FAILED: [reason] if any criterion is not met`;
}
```

`src/modules/execution/verifier.ts`:

```typescript
import type { SpecGoal } from "../../core/types.js";
import { runQuery } from "../../sdk/index.js";
import { EXECUTION_TOOLS } from "../../sdk/tool-config.js";
import { buildVerificationPrompt } from "./planner.js";

export interface VerificationResult {
  passed: boolean;
  reason: string;
  costUsd: number;
}

export async function verifyGoal(
  goal: SpecGoal,
  projectPath: string,
  model: string
): Promise<VerificationResult> {
  const prompt = buildVerificationPrompt(goal);

  const result = await runQuery({
    prompt,
    allowedTools: EXECUTION_TOOLS,
    cwd: projectPath,
    model,
    maxTurns: 20,
  });

  const text = result?.text ?? "";
  const passed = text.includes("VERIFIED");
  const reason = passed
    ? "All acceptance criteria met"
    : text.replace(/^FAILED:\s*/i, "").trim() || "Verification failed";

  return {
    passed,
    reason,
    costUsd: result?.costUsd ?? 0,
  };
}
```

`src/modules/execution/execution.phase.ts`:

```typescript
import type { Phase, PhaseResult, AgentContext } from "../../core/types.js";
import { GoalTracker } from "../goals/index.js";
import { runQuery } from "../../sdk/index.js";
import { EXECUTION_TOOLS } from "../../sdk/tool-config.js";
import { buildExecutionPrompt } from "./planner.js";
import { verifyGoal } from "./verifier.js";
import type { Logger } from "../logging/logger.js";
import type { ExecutionSummary } from "./types.js";

export class ExecutionPhase implements Phase {
  name = "execution" as const;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async execute(context: AgentContext): Promise<PhaseResult> {
    const { config, projectPath } = context;
    const spec = context.spec;

    if (!spec) {
      throw new Error("No spec available for execution");
    }

    const tracker = new GoalTracker(spec.goals, config.maxRetriesPerGoal);
    const completedSummaries: string[] = [];
    const summary: ExecutionSummary = {
      completed: [],
      failed: [],
      skipped: [],
      totalCostUsd: 0,
    };

    while (!tracker.isAllDone()) {
      const next = tracker.getNextPending();
      if (!next) {
        this.logger.log({
          type: "warning",
          message: "No actionable goals remaining (possible dependency deadlock)",
        });
        break;
      }

      const goalSpec = spec.goals.find((g) => g.id === next.id)!;

      // Check budget
      const remainingBudget = config.budget.maxTotal - tracker.totalCost();
      if (remainingBudget <= 0) {
        this.logger.log({
          type: "error",
          message: `Total budget exhausted ($${config.budget.maxTotal})`,
        });
        break;
      }

      this.logger.log({
        type: "goal_start",
        message: `Goal ${goalSpec.id}: ${goalSpec.name}`,
      });

      tracker.start(next.id);

      // Execute the goal
      const executionPrompt = buildExecutionPrompt(goalSpec, completedSummaries);
      const result = await runQuery(
        {
          prompt: executionPrompt,
          allowedTools: EXECUTION_TOOLS,
          cwd: projectPath,
          model: config.model,
          maxTurns: 50,
          maxBudgetUsd: Math.min(config.budget.maxPerGoal, remainingBudget),
        },
        this.logger,
      );

      const executionCost = result?.costUsd ?? 0;

      // Verify
      tracker.startVerifying(next.id);
      this.logger.log({ type: "info", message: "Verifying goal..." });

      const verification = await verifyGoal(goalSpec, projectPath, config.model);
      const totalGoalCost = executionCost + verification.costUsd;

      if (verification.passed) {
        tracker.complete(next.id, totalGoalCost);
        completedSummaries.push(`${goalSpec.name}: ${result?.text ?? "completed"}`);
        summary.completed.push(goalSpec.id);

        this.logger.log({
          type: "goal_complete",
          message: `Goal ${goalSpec.id}: ${goalSpec.name}`,
          costUsd: totalGoalCost,
        });
      } else {
        tracker.fail(next.id, verification.reason);

        if (tracker.canRetry(next.id)) {
          this.logger.log({
            type: "goal_fail",
            message: `Goal ${goalSpec.id} failed: ${verification.reason}. Retrying...`,
          });
          tracker.retry(next.id);
        } else {
          tracker.skip(next.id);
          summary.skipped.push(goalSpec.id);
          this.logger.log({
            type: "goal_skip",
            message: `Goal ${goalSpec.id}: ${goalSpec.name} (max retries exceeded)`,
          });
        }
      }
    }

    summary.totalCostUsd = tracker.totalCost();

    context.state.goals = tracker.getAll();
    context.state.totalCostUsd = summary.totalCostUsd;

    return {
      next: "standby",
      data: summary as unknown as Record<string, unknown>,
    };
  }
}
```

`src/modules/execution/index.ts`:

```typescript
export { ExecutionPhase } from "./execution.phase.js";
export { buildExecutionPrompt, buildVerificationPrompt } from "./planner.js";
export { verifyGoal } from "./verifier.js";
export type { VerificationResult } from "./verifier.js";
export type { ExecutionSummary } from "./types.js";
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/modules/execution/planner.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/modules/execution/ tests/unit/modules/execution/
git commit -m "add execution phase with planner, verifier, and goal loop"
```

---

## Task 12: Standby Phase

**Files:**
- Create: `src/modules/standby/standby.phase.ts`
- Create: `src/modules/standby/index.ts`

**Step 1: Write the test**

Create `tests/unit/modules/standby/standby.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildStandbyPrompt } from "../../../../src/modules/standby/index.js";
import type { Spec } from "../../../../src/core/types.js";

describe("standby", () => {
  it("builds standby prompt with spec summary", () => {
    const spec: Spec = {
      overview: "A todo app",
      goals: [
        {
          id: "1",
          name: "Setup",
          description: "Init project",
          acceptanceCriteria: ["works"],
          dependsOn: [],
        },
      ],
      technicalDecisions: ["Next.js"],
    };

    const prompt = buildStandbyPrompt(spec, ["1: Setup - done"], ["$1.50"]);
    expect(prompt).toContain("todo app");
    expect(prompt).toContain("Setup");
    expect(prompt).toContain("new goals");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/modules/standby/standby.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

`src/modules/standby/standby.phase.ts`:

```typescript
import type { Phase, PhaseResult, AgentContext } from "../../core/types.js";
import { runQuery } from "../../sdk/index.js";
import { STANDBY_TOOLS } from "../../sdk/tool-config.js";
import * as readline from "readline";

export function buildStandbyPrompt(
  spec: import("../../core/types.js").Spec,
  goalResults: string[],
  costInfo: string[]
): string {
  return `You are a project assistant in standby mode. The project has been built according to this spec:

## Project Overview
${spec.overview}

## Goals completed
${goalResults.map((r) => `- ${r}`).join("\n")}

## Cost info
${costInfo.join("\n")}

You are now waiting for follow-up instructions. The user may:
- Ask questions about what was built
- Request changes to completed work
- Add new goals (respond with NEW_GOALS_REQUESTED to trigger a new interview)
- Say "quit" or "exit" to stop

Be helpful and concise.`;
}

export class StandbyPhase implements Phase {
  name = "standby" as const;

  async execute(context: AgentContext): Promise<PhaseResult> {
    const { config, state, projectPath } = context;
    const spec = context.spec;

    if (!spec) {
      return { next: "done" };
    }

    const goalResults = state.goals.map(
      (g) => `${g.id}: ${spec.goals.find((sg) => sg.id === g.id)?.name ?? g.id} - ${g.status}`
    );
    const costInfo = [`Total cost: $${state.totalCostUsd.toFixed(2)}`];

    const systemPrompt = buildStandbyPrompt(spec, goalResults, costInfo);
    let sessionId: string | undefined;

    console.log(
      `\nAll goals processed. Total cost: $${state.totalCostUsd.toFixed(2)}`
    );
    console.log("Waiting for instructions... (type 'quit' to exit)\n");

    while (true) {
      const input = await this.askUser("> ");

      if (input.toLowerCase() === "quit" || input.toLowerCase() === "exit") {
        return { next: "done" };
      }

      const result = await runQuery(
        {
          prompt: input,
          systemPrompt: sessionId ? undefined : systemPrompt,
          allowedTools: STANDBY_TOOLS,
          cwd: projectPath,
          model: config.model,
          maxTurns: 30,
          resume: sessionId,
        },
        undefined,
        {
          onSessionId: (id) => {
            sessionId = id;
          },
        }
      );

      const text = result?.text ?? "";

      if (text.includes("NEW_GOALS_REQUESTED")) {
        return { next: "interview" };
      }

      console.log(`\n${text}\n`);
    }
  }

  private askUser(prompt: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }
}
```

`src/modules/standby/index.ts`:

```typescript
export { StandbyPhase, buildStandbyPrompt } from "./standby.phase.js";
export type { StandbyCommand } from "./types.js";
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/modules/standby/standby.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/modules/standby/ tests/unit/modules/standby/
git commit -m "add standby phase with follow-up loop"
```

---

## Task 13: CLI Module

**Files:**
- Create: `src/cli/output.ts`
- Create: `src/cli/commands.ts`
- Create: `src/cli/index.ts`

**Step 1: Write the test**

Create `tests/unit/cli/output.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { printBanner, printPhaseHeader } from "../../../src/cli/output.js";

describe("cli output", () => {
  it("printBanner returns formatted string", () => {
    const output = printBanner();
    expect(output).toContain("Small Singularity");
  });

  it("printPhaseHeader formats phase name", () => {
    const output = printPhaseHeader("interview");
    expect(output).toContain("Interview");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/cli/output.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

`src/cli/output.ts`:

```typescript
export function printBanner(): string {
  return `
 Small Singularity
 Autonomous Project Agent
`;
}

export function printPhaseHeader(phase: string): string {
  const name = phase.charAt(0).toUpperCase() + phase.slice(1);
  return `\n--- ${name} ${"─".repeat(50 - name.length)}`;
}
```

`src/cli/commands.ts`:

```typescript
import { Command } from "commander";
import { loadConfig } from "../config/index.js";
import { createInitialState, loadState, saveState } from "../modules/state/index.js";
import { createLogger, formatForTerminal } from "../modules/logging/index.js";
import { Agent } from "../core/agent.js";
import { InterviewPhase } from "../modules/interview/index.js";
import { SpecPhase } from "../modules/spec/index.js";
import { ExecutionPhase } from "../modules/execution/index.js";
import { StandbyPhase } from "../modules/standby/index.js";
import { printBanner, printPhaseHeader } from "./output.js";
import { join, resolve } from "path";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("small-singularity")
    .description("Autonomous project agent")
    .version("0.1.0");

  program
    .command("start")
    .description("Start the agent on a project directory")
    .argument("<project-path>", "Path to the project directory")
    .option("-m, --model <model>", "Claude model to use", "sonnet")
    .option("--budget <amount>", "Max total budget in USD", "20")
    .option("--budget-per-goal <amount>", "Max budget per goal in USD", "2")
    .option("-v, --verbose", "Verbose logging", false)
    .action(async (projectPath: string, opts) => {
      const resolvedPath = resolve(projectPath);

      console.log(printBanner());

      const config = loadConfig({
        projectPath: resolvedPath,
        model: opts.model,
        budget: {
          maxTotal: parseFloat(opts.budget),
          maxPerGoal: parseFloat(opts.budgetPerGoal),
        },
        verbose: opts.verbose,
      });

      const specsDir = join(resolvedPath, "specs");
      const state = loadState(specsDir) ?? createInitialState();

      const logger = createLogger({
        sink: (event) => {
          console.log(formatForTerminal(event));
        },
      });

      const agent = new Agent({
        interview: new InterviewPhase(),
        spec: new SpecPhase(),
        execution: new ExecutionPhase(logger),
        standby: new StandbyPhase(),
      });

      await agent.run(
        {
          config,
          state,
          projectPath: resolvedPath,
          spec: state.spec,
        },
        logger
      );

      saveState(specsDir, state);
      console.log("\nAgent stopped. State saved.");
    });

  program
    .command("status")
    .description("Show current project status")
    .argument("<project-path>", "Path to the project directory")
    .action((projectPath: string) => {
      const resolvedPath = resolve(projectPath);
      const specsDir = join(resolvedPath, "specs");
      const state = loadState(specsDir);

      if (!state) {
        console.log("No state found. Run 'start' first.");
        return;
      }

      console.log(`Phase: ${state.currentPhase}`);
      console.log(`Total cost: $${state.totalCostUsd.toFixed(2)}`);
      console.log(`Goals: ${state.goals.length}`);
      for (const goal of state.goals) {
        console.log(`  ${goal.id}: ${goal.status} ($${goal.costUsd.toFixed(2)})`);
      }
    });

  return program;
}
```

`src/cli/index.ts`:

```typescript
export { createProgram } from "./commands.js";
export { printBanner, printPhaseHeader } from "./output.js";
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/cli/output.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/cli/ tests/unit/cli/
git commit -m "add CLI module with start and status commands"
```

---

## Task 14: Entry Point & Wiring

**Files:**
- Create: `src/index.ts`

**Step 1: Write the entry point**

`src/index.ts`:

```typescript
#!/usr/bin/env node

import { createProgram } from "./cli/index.js";

const program = createProgram();
program.parse();
```

**Step 2: Verify it builds**

```bash
npx tsc --noEmit
```

Expected: No errors (or only SDK-related type warnings which are acceptable).

**Step 3: Verify it runs**

```bash
npx tsx src/index.ts --help
```

Expected: Shows help text with `start` and `status` commands.

**Step 4: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "add entry point and wire all modules together"
```

---

## Task 15: Integration Test — Full Agent Flow

**Files:**
- Create: `tests/integration/agent-flow.test.ts`
- Create: `tests/fixtures/sample-spec.md`

**Step 1: Create fixture**

`tests/fixtures/sample-spec.md`:

```markdown
# Project Spec

## Overview
A simple hello world CLI app

## Goals
### Goal 1: Create main file
Create a main.ts file that prints hello world
**Acceptance Criteria:**
- Running the file prints "Hello, World!"

## Technical Decisions
- TypeScript
- Node.js
```

**Step 2: Write the integration test**

`tests/integration/agent-flow.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { Agent } from "../../src/core/agent.js";
import { GoalTracker } from "../../src/modules/goals/index.js";
import { createInitialState } from "../../src/modules/state/index.js";
import { loadConfig } from "../../src/config/index.js";
import { createLogger } from "../../src/modules/logging/index.js";
import { parseSpec } from "../../src/modules/spec/index.js";
import { readFileSync } from "fs";
import { join } from "path";
import type { Phase, PhaseResult } from "../../src/core/types.js";

describe("agent flow integration", () => {
  it("transitions through all phases with mock phases", async () => {
    const transitions: string[] = [];

    const mockPhase = (name: string, next: string): Phase => ({
      name: name as any,
      execute: async () => {
        transitions.push(name);
        return { next } as PhaseResult;
      },
    });

    const agent = new Agent({
      interview: mockPhase("interview", "spec"),
      spec: mockPhase("spec", "execution"),
      execution: mockPhase("execution", "standby"),
      standby: mockPhase("standby", "done"),
    });

    const config = loadConfig({ projectPath: "/tmp/test" });
    const state = createInitialState();
    const logger = createLogger({ sink: () => {} });

    await agent.run({ config, state, projectPath: "/tmp/test", spec: null }, logger);

    expect(transitions).toEqual(["interview", "spec", "execution", "standby"]);
  });

  it("parses sample spec fixture", () => {
    const fixturePath = join(import.meta.dirname, "../fixtures/sample-spec.md");
    const md = readFileSync(fixturePath, "utf-8");
    const spec = parseSpec(md);

    expect(spec.overview).toContain("hello world");
    expect(spec.goals).toHaveLength(1);
    expect(spec.goals[0].name).toBe("Create main file");
    expect(spec.goals[0].acceptanceCriteria).toContain(
      'Running the file prints "Hello, World!"'
    );
  });

  it("goal tracker works with parsed spec goals", () => {
    const fixturePath = join(import.meta.dirname, "../fixtures/sample-spec.md");
    const md = readFileSync(fixturePath, "utf-8");
    const spec = parseSpec(md);

    const tracker = new GoalTracker(spec.goals, 2);
    expect(tracker.getNextPending()?.id).toBe("1");

    tracker.start("1");
    tracker.startVerifying("1");
    tracker.complete("1", 0.25);

    expect(tracker.isAllDone()).toBe(true);
    expect(tracker.totalCost()).toBe(0.25);
  });
});
```

**Step 3: Run integration tests**

```bash
npx vitest run tests/integration/
```

Expected: All 3 tests pass.

**Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add tests/integration/ tests/fixtures/
git commit -m "add integration tests and sample spec fixture"
```

---

## Summary

| Task | Module | Description |
|------|--------|-------------|
| 1 | — | Project scaffolding |
| 2 | `core/` | Core type definitions |
| 3 | `config/` | Config loader with defaults |
| 4 | `modules/state/` | State persistence |
| 5 | `modules/logging/` | Logger with filters and formatters |
| 6 | `modules/goals/` | Goal tracker state machine |
| 7 | `sdk/` | SDK wrapper, message handler, tool config |
| 8 | `core/` | Agent orchestrator + phase interface |
| 9 | `modules/interview/` | Interview phase |
| 10 | `modules/spec/` | Spec phase with writer/parser |
| 11 | `modules/execution/` | Execution phase with planner/verifier |
| 12 | `modules/standby/` | Standby phase |
| 13 | `cli/` | CLI commands and output |
| 14 | `src/` | Entry point wiring |
| 15 | `tests/` | Integration tests |

Dependencies flow: Tasks 1 → 2 → 3,4,5,6 (parallel) → 7 → 8 → 9,10,11,12 (parallel) → 13 → 14 → 15

# API Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a GraphQL API server that manages projects, spawns CLI agents, and pushes real-time updates via subscriptions.

**Architecture:** Express + Apollo Server for GraphQL queries/mutations. graphql-ws for subscriptions. An AgentManager class spawns CLI agent child processes and publishes state changes via PubSub. All data read/written through @small-singularity/core's StateStore and ProjectStore.

**Tech Stack:** Express, Apollo Server 4, graphql, graphql-ws, ws, @small-singularity/core

---

## Task 1: Scaffold API package

**Files:**
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/vitest.config.ts`
- Create: `packages/api/src/index.ts` (placeholder)

**Step 1: Create packages/api/package.json**

```json
{
  "name": "@small-singularity/api",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@small-singularity/core": "workspace:*",
    "@apollo/server": "^4.11.0",
    "graphql": "^16.9.0",
    "graphql-ws": "^6.0.4",
    "graphql-subscriptions": "^3.0.0",
    "express": "^4.21.0",
    "cors": "^2.8.5",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "@types/ws": "^8.5.12",
    "@types/node": "^25.5.0",
    "@types/better-sqlite3": "^7.6.13",
    "better-sqlite3": "^12.8.0",
    "typescript": "^5.9.3",
    "tsx": "^4.21.0",
    "vitest": "^4.1.0"
  }
}
```

**Step 2: Create packages/api/tsconfig.json**

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

**Step 3: Create packages/api/vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globals: true,
  },
});
```

**Step 4: Create placeholder src/index.ts**

```typescript
console.log("@small-singularity/api starting...");
```

**Step 5: Install and verify**

```bash
cd /Users/ozan/Projects/small-singularity
COREPACK_ENABLE_STRICT=0 pnpm install
cd packages/api && npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add packages/api/
git commit -m "scaffold @small-singularity/api package"
```

---

## Task 2: GraphQL Schema + Type Definitions

**Files:**
- Create: `packages/api/src/schema/type-defs.ts`
- Create: `packages/api/src/schema/index.ts`

**Step 1: Create type-defs.ts**

```typescript
export const typeDefs = `#graphql
  type Project {
    id: ID!
    name: String!
    path: String!
    phase: String!
    totalCost: Float!
    spec: Spec
    goals: [Goal!]!
    interviewNotes: [String!]!
    isRunning: Boolean!
    createdAt: String!
  }

  type Spec {
    overview: String!
    goals: [SpecGoal!]!
    technicalDecisions: [String!]!
  }

  type SpecGoal {
    id: ID!
    name: String!
    description: String!
    acceptanceCriteria: [String!]!
    dependsOn: [ID!]!
  }

  type Goal {
    id: ID!
    name: String!
    status: String!
    retries: Int!
    costUsd: Float!
    error: String
  }

  type LogEvent {
    type: String!
    message: String!
    costUsd: Float
    timestamp: String!
    projectId: ID!
  }

  type Query {
    projects: [Project!]!
    project(id: ID!): Project
  }

  type Mutation {
    createProject(name: String!, path: String!): Project!
    deleteProject(id: ID!): Boolean!
    startAgent(projectId: ID!): Project!
    stopAgent(projectId: ID!): Project!
  }

  type Subscription {
    projectUpdated(projectId: ID!): Project!
    logEvent(projectId: ID!): LogEvent!
  }
`;
```

**Step 2: Create schema/index.ts barrel**

```typescript
export { typeDefs } from "./type-defs.js";
```

**Step 3: Commit**

```bash
git add packages/api/src/schema/
git commit -m "add GraphQL schema type definitions"
```

---

## Task 3: Query and Mutation Resolvers

**Files:**
- Create: `packages/api/src/schema/resolvers.ts`
- Modify: `packages/api/src/schema/index.ts`
- Create: `packages/api/tests/unit/resolvers.test.ts`

**Step 1: Write tests for resolvers**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { SCHEMA_SQL, SQLiteProjectStore, SQLiteStore } from "@small-singularity/core";
import { createResolvers } from "../../src/schema/resolvers.js";

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);
  return db;
}

describe("resolvers", () => {
  let db: Database.Database;
  let resolvers: ReturnType<typeof createResolvers>;

  beforeEach(() => {
    db = createTestDb();
    resolvers = createResolvers(() => db, () => new Set());
  });

  afterEach(() => {
    db.close();
  });

  describe("Query", () => {
    it("projects returns empty list initially", async () => {
      const result = await resolvers.Query.projects();
      expect(result).toEqual([]);
    });

    it("project returns null for unknown id", async () => {
      const result = await resolvers.Query.project(null, { id: "unknown" });
      expect(result).toBeNull();
    });
  });

  describe("Mutation", () => {
    it("createProject creates and returns a project", async () => {
      const result = await resolvers.Mutation.createProject(null, {
        name: "test",
        path: "/tmp/test",
      });
      expect(result.name).toBe("test");
      expect(result.path).toBe("/tmp/test");
      expect(result.phase).toBe("interview");
      expect(result.isRunning).toBe(false);
    });

    it("deleteProject removes a project", async () => {
      const project = await resolvers.Mutation.createProject(null, {
        name: "test",
        path: "/tmp/test",
      });
      const deleted = await resolvers.Mutation.deleteProject(null, {
        id: project.id,
      });
      expect(deleted).toBe(true);
      const found = await resolvers.Query.project(null, { id: project.id });
      expect(found).toBeNull();
    });
  });
});
```

**Step 2: Implement resolvers**

`packages/api/src/schema/resolvers.ts`:

```typescript
import {
  SQLiteProjectStore,
  SQLiteStore,
  type ProjectRecord,
  type StateStore,
  type GoalState,
  type Spec,
} from "@small-singularity/core";
import type Database from "better-sqlite3";

interface ProjectView {
  id: string;
  name: string;
  path: string;
  phase: string;
  totalCost: number;
  spec: Spec | null;
  goals: GoalState[];
  interviewNotes: string[];
  isRunning: boolean;
  createdAt: string;
}

function projectToView(
  record: ProjectRecord,
  store: StateStore,
  runningIds: Set<string>
): ProjectView {
  return {
    id: record.id,
    name: record.name,
    path: record.path,
    phase: store.getPhase(),
    totalCost: store.getTotalCost(),
    spec: store.getSpec(),
    goals: store.getGoals(),
    interviewNotes: store.getInterviewNotes(),
    isRunning: runningIds.has(record.id),
    createdAt: record.createdAt,
  };
}

export function createResolvers(
  getDb: () => Database.Database,
  getRunningIds: () => Set<string>
) {
  function withProjectStore<T>(fn: (store: SQLiteProjectStore) => T): T {
    const store = new SQLiteProjectStore(getDb());
    try {
      return fn(store);
    } finally {
      // Don't close — shared db connection
    }
  }

  function withStateStore<T>(projectId: string, fn: (store: SQLiteStore) => T): T {
    const store = new SQLiteStore(getDb(), projectId);
    try {
      return fn(store);
    } finally {
      // Don't close — shared db connection
    }
  }

  return {
    Query: {
      projects(): ProjectView[] {
        const db = getDb();
        const projectStore = new SQLiteProjectStore(db);
        const records = projectStore.listProjects();
        const runningIds = getRunningIds();
        return records.map((r) => {
          const store = new SQLiteStore(db, r.id);
          return projectToView(r, store, runningIds);
        });
      },

      project(_: any, args: { id: string }): ProjectView | null {
        const db = getDb();
        const projectStore = new SQLiteProjectStore(db);
        const record = projectStore.getProject(args.id);
        if (!record) return null;
        const store = new SQLiteStore(db, record.id);
        return projectToView(record, store, getRunningIds());
      },
    },

    Mutation: {
      createProject(_: any, args: { name: string; path: string }): ProjectView {
        const db = getDb();
        const projectStore = new SQLiteProjectStore(db);
        const record = projectStore.createProject(args.name, args.path);
        const store = new SQLiteStore(db, record.id);
        return projectToView(record, store, getRunningIds());
      },

      deleteProject(_: any, args: { id: string }): boolean {
        const db = getDb();
        const projectStore = new SQLiteProjectStore(db);
        return projectStore.deleteProject(args.id);
      },

      startAgent(_: any, args: { projectId: string }): ProjectView {
        // Agent spawning is handled by the AgentManager (Task 5)
        // For now, just return the project
        const db = getDb();
        const projectStore = new SQLiteProjectStore(db);
        const record = projectStore.getProject(args.projectId);
        if (!record) throw new Error(`Project ${args.projectId} not found`);
        const store = new SQLiteStore(db, record.id);
        return projectToView(record, store, getRunningIds());
      },

      stopAgent(_: any, args: { projectId: string }): ProjectView {
        // Agent stopping is handled by the AgentManager (Task 5)
        const db = getDb();
        const projectStore = new SQLiteProjectStore(db);
        const record = projectStore.getProject(args.projectId);
        if (!record) throw new Error(`Project ${args.projectId} not found`);
        const store = new SQLiteStore(db, record.id);
        return projectToView(record, store, getRunningIds());
      },
    },
  };
}
```

**Step 3: Update schema/index.ts**

```typescript
export { typeDefs } from "./type-defs.js";
export { createResolvers } from "./resolvers.js";
```

**Step 4: Run tests**

```bash
cd packages/api && npx vitest run
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add packages/api/src/schema/ packages/api/tests/
git commit -m "add GraphQL query and mutation resolvers"
```

---

## Task 4: Subscription Support with PubSub

**Files:**
- Create: `packages/api/src/subscriptions/pubsub.ts`
- Create: `packages/api/src/subscriptions/index.ts`
- Modify: `packages/api/src/schema/resolvers.ts` (add subscription resolvers)

**Step 1: Create pubsub.ts**

```typescript
import { PubSub } from "graphql-subscriptions";

export const pubsub = new PubSub();

export const EVENTS = {
  PROJECT_UPDATED: "PROJECT_UPDATED",
  LOG_EVENT: "LOG_EVENT",
} as const;
```

**Step 2: Create subscriptions/index.ts**

```typescript
export { pubsub, EVENTS } from "./pubsub.js";
```

**Step 3: Add subscription resolvers to resolvers.ts**

Add to the return object of `createResolvers`:

```typescript
import { pubsub, EVENTS } from "../subscriptions/index.js";
import { withFilter } from "graphql-subscriptions";

// Add inside createResolvers return:
Subscription: {
  projectUpdated: {
    subscribe: withFilter(
      () => pubsub.asyncIterableIterator(EVENTS.PROJECT_UPDATED),
      (payload, variables) => payload.projectUpdated.id === variables.projectId
    ),
  },
  logEvent: {
    subscribe: withFilter(
      () => pubsub.asyncIterableIterator(EVENTS.LOG_EVENT),
      (payload, variables) => payload.logEvent.projectId === variables.projectId
    ),
  },
},
```

**Step 4: Commit**

```bash
git add packages/api/src/subscriptions/ packages/api/src/schema/
git commit -m "add GraphQL subscription support with PubSub"
```

---

## Task 5: Agent Manager

**Files:**
- Create: `packages/api/src/agent-manager/manager.ts`
- Create: `packages/api/src/agent-manager/index.ts`
- Create: `packages/api/tests/unit/agent-manager.test.ts`

**Step 1: Write test**

```typescript
import { describe, it, expect } from "vitest";
import { AgentManager } from "../../src/agent-manager/index.js";

describe("AgentManager", () => {
  it("tracks running agents", () => {
    const manager = new AgentManager();
    expect(manager.isRunning("project-1")).toBe(false);
    expect(manager.getRunningIds()).toEqual(new Set());
  });
});
```

**Step 2: Implement AgentManager**

`packages/api/src/agent-manager/manager.ts`:

```typescript
import { spawn, type ChildProcess } from "child_process";
import { resolve } from "path";
import { pubsub, EVENTS } from "../subscriptions/index.js";
import type { SQLiteStore, SQLiteProjectStore } from "@small-singularity/core";

export class AgentManager {
  private processes = new Map<string, ChildProcess>();

  isRunning(projectId: string): boolean {
    return this.processes.has(projectId);
  }

  getRunningIds(): Set<string> {
    return new Set(this.processes.keys());
  }

  start(projectId: string, projectPath: string): void {
    if (this.processes.has(projectId)) {
      throw new Error(`Agent already running for project ${projectId}`);
    }

    // Find the CLI entry point
    const cliPath = resolve(
      import.meta.dirname,
      "../../cli/src/index.ts"
    );

    const child = spawn("npx", ["tsx", cliPath, "start", projectPath], {
      cwd: projectPath,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    this.processes.set(projectId, child);

    // Stream stdout for log events
    child.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        pubsub.publish(EVENTS.LOG_EVENT, {
          logEvent: {
            type: "info",
            message: line.trim(),
            timestamp: new Date().toISOString(),
            projectId,
          },
        });
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        pubsub.publish(EVENTS.LOG_EVENT, {
          logEvent: {
            type: "error",
            message: line.trim(),
            timestamp: new Date().toISOString(),
            projectId,
          },
        });
      }
    });

    child.on("exit", (code) => {
      this.processes.delete(projectId);
      pubsub.publish(EVENTS.LOG_EVENT, {
        logEvent: {
          type: "info",
          message: `Agent exited with code ${code}`,
          timestamp: new Date().toISOString(),
          projectId,
        },
      });
    });
  }

  stop(projectId: string): void {
    const child = this.processes.get(projectId);
    if (!child) return;
    child.kill("SIGTERM");
    this.processes.delete(projectId);
  }

  stopAll(): void {
    for (const [id] of this.processes) {
      this.stop(id);
    }
  }
}
```

**Step 3: Create index.ts barrel**

```typescript
export { AgentManager } from "./manager.js";
```

**Step 4: Wire AgentManager into resolvers**

Update `startAgent` and `stopAgent` mutations in resolvers.ts to accept an `agentManager` parameter and call `agentManager.start()` / `agentManager.stop()`.

Update `createResolvers` signature:
```typescript
export function createResolvers(
  getDb: () => Database.Database,
  getRunningIds: () => Set<string>,
  agentManager?: AgentManager
)
```

**Step 5: Run tests**

```bash
cd packages/api && npx vitest run
```

**Step 6: Commit**

```bash
git add packages/api/src/agent-manager/ packages/api/tests/ packages/api/src/schema/
git commit -m "add AgentManager for spawning and tracking CLI agents"
```

---

## Task 6: Express + Apollo Server + WebSocket Setup

**Files:**
- Modify: `packages/api/src/index.ts` (full server setup)
- Create: `packages/api/tests/unit/server.test.ts`

**Step 1: Write a basic server test**

```typescript
import { describe, it, expect } from "vitest";
import { createServer } from "../../src/index.js";

describe("server", () => {
  it("creates an express app", async () => {
    const { app } = await createServer();
    expect(app).toBeDefined();
  });
});
```

**Step 2: Implement the server**

`packages/api/src/index.ts`:

```typescript
import express from "express";
import cors from "cors";
import { createServer as createHttpServer } from "http";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/use/ws";
import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { SCHEMA_SQL } from "@small-singularity/core";
import { typeDefs, createResolvers } from "./schema/index.js";
import { AgentManager } from "./agent-manager/index.js";

function getDatabase(): Database.Database {
  const dir = join(homedir(), ".small-singularity");
  mkdirSync(dir, { recursive: true });
  const dbPath = join(dir, "db.sqlite");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);
  return db;
}

export async function createServer(port = 4000) {
  const app = express();
  const httpServer = createHttpServer(app);

  const db = getDatabase();
  const agentManager = new AgentManager();

  const resolvers = createResolvers(
    () => db,
    () => agentManager.getRunningIds(),
    agentManager
  );

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });
  const serverCleanup = useServer({ schema }, wsServer);

  const apolloServer = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await apolloServer.start();

  app.use(
    "/graphql",
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware(apolloServer)
  );

  // Health check
  app.get("/health", (_, res) => res.json({ status: "ok" }));

  return {
    app,
    httpServer,
    db,
    agentManager,
    async start() {
      return new Promise<void>((resolve) => {
        httpServer.listen(port, () => {
          console.log(`API server running at http://localhost:${port}/graphql`);
          console.log(`Subscriptions at ws://localhost:${port}/graphql`);
          resolve();
        });
      });
    },
    async stop() {
      agentManager.stopAll();
      await apolloServer.stop();
      db.close();
    },
  };
}

// Start if run directly
const isMain = process.argv[1]?.includes("index");
if (isMain) {
  createServer().then(({ start }) => start());
}
```

Note: This requires `@graphql-tools/schema` — add it to dependencies:
```bash
cd packages/api && pnpm add @graphql-tools/schema
```

**Step 3: Verify the server starts**

```bash
cd packages/api && npx tsx src/index.ts
# Should print: API server running at http://localhost:4000/graphql
# Ctrl+C to stop
```

**Step 4: Run tests**

```bash
cd packages/api && npx vitest run
```

**Step 5: Add dev script to root package.json**

Add to root package.json scripts:
```json
"dev:api": "pnpm --filter @small-singularity/api dev"
```

**Step 6: Commit**

```bash
git add -A
git commit -m "add Express + Apollo Server with WebSocket subscriptions"
```

---

## Summary

| Task | What | Key Files |
|------|------|-----------|
| 1 | Scaffold API package | package.json, tsconfig.json |
| 2 | GraphQL schema | schema/type-defs.ts |
| 3 | Query/mutation resolvers | schema/resolvers.ts + tests |
| 4 | Subscription support | subscriptions/pubsub.ts |
| 5 | Agent manager | agent-manager/manager.ts + tests |
| 6 | Server wiring | index.ts (Express + Apollo + WS) |

Dependencies: 1 → 2 → 3 → 4 → 5 → 6

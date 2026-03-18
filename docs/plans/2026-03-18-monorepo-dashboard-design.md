# Monorepo + Dashboard Design

## Overview

Convert small-singularity from a single CLI package into a monorepo with 4 packages: core (shared library), cli (agent), api (GraphQL server), and dashboard (React frontend). Single central SQLite database at `~/.small-singularity/db.sqlite` with project_id scoping.

## Monorepo Structure

```
small-singularity/
├── packages/
│   ├── core/                  # Shared library
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── state/         # StateStore + SQLite, ProjectStore
│   │   │   ├── sdk/           # SDK client wrapper
│   │   │   ├── goals/         # GoalTracker
│   │   │   ├── logging/       # Logger, spinner, filters
│   │   │   └── config/        # Config loader
│   │   ├── package.json       # @small-singularity/core
│   │   └── tsconfig.json
│   │
│   ├── cli/                   # CLI agent
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── commands.ts
│   │   │   ├── output.ts
│   │   │   └── phases/        # interview, spec, execution, standby
│   │   ├── package.json       # @small-singularity/cli
│   │   └── tsconfig.json
│   │
│   ├── api/                   # GraphQL API + agent orchestrator
│   │   ├── src/
│   │   │   ├── index.ts       # Express + Apollo Server
│   │   │   ├── schema/        # GraphQL type defs + resolvers
│   │   │   ├── subscriptions/ # PubSub + subscription resolvers
│   │   │   └── agent-manager/ # Spawns/tracks CLI agent processes
│   │   ├── package.json       # @small-singularity/api
│   │   └── tsconfig.json
│   │
│   └── dashboard/             # Vite + React frontend
│       ├── src/
│       │   ├── App.tsx
│       │   ├── pages/
│       │   ├── components/
│       │   └── hooks/
│       ├── package.json       # @small-singularity/dashboard
│       └── tsconfig.json
│
├── pnpm-workspace.yaml
├── package.json               # Root
├── tsconfig.base.json
└── docs/plans/
```

## Central Database

Single SQLite at `~/.small-singularity/db.sqlite`. All tables scoped by `project_id`.

### Schema

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE project_state (
  project_id TEXT PRIMARY KEY REFERENCES projects(id),
  current_phase TEXT NOT NULL DEFAULT 'interview',
  total_cost_usd REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE interview_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE spec (
  project_id TEXT PRIMARY KEY REFERENCES projects(id),
  overview TEXT NOT NULL,
  technical_decisions TEXT NOT NULL
);

CREATE TABLE goals (
  id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  acceptance_criteria TEXT NOT NULL,
  depends_on TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  retries INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  error TEXT,
  session_id TEXT,
  PRIMARY KEY (project_id, id)
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id),
  phase TEXT NOT NULL,
  session_id TEXT NOT NULL,
  goal_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## GraphQL API

### Schema

```graphql
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
  phaseChanged(projectId: ID!): String!
  goalUpdated(projectId: ID!): Goal!
  costUpdated(projectId: ID!): Float!
  logEvent(projectId: ID!): LogEvent!
}
```

### Tech

- Apollo Server with Express adapter
- graphql-ws for subscriptions over WebSocket
- Resolvers read from central SQLite via StateStore/ProjectStore
- Agent Manager spawns CLI processes, publishes subscription events via PubSub

### Real-time flow

```
Agent CLI writes to SQLite
  → Agent Manager detects change (stdout events from child process)
  → Publishes to PubSub
  → GraphQL Subscriptions push to dashboard
```

## Dashboard

### Pages

- `/` — Project list with cards (name, phase, progress, cost, running badge)
- `/projects/:id` — Project detail (spec, goals, log stream, controls)
- `/projects/new` — Register new project (name + path)

### Components

- ProjectCard — name, phase pill, progress bar, cost, running indicator
- GoalList — table with status badges, cost per goal
- LogStream — scrolling curated log feed, auto-scroll, filterable
- SpecView — rendered spec markdown with acceptance criteria
- AgentControls — start/stop, model selector, budget inputs

### Tech

- Vite + React + TypeScript
- Apollo Client with graphql-ws for subscriptions
- Tailwind CSS + shadcn/ui

## Tech Stack Summary

| Package | Key Dependencies |
|---------|-----------------|
| core | better-sqlite3, @anthropic-ai/claude-agent-sdk |
| cli | commander, core |
| api | apollo-server, express, graphql-ws, core |
| dashboard | react, vite, apollo-client, tailwind, shadcn/ui |
| root | pnpm workspaces |

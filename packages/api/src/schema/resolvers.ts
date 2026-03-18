import {
  SQLiteProjectStore,
  SQLiteStore,
  type ProjectRecord,
  type StateStore,
  type GoalState,
  type Spec,
} from "@small-singularity/core";
import type Database from "better-sqlite3";
import { withFilter } from "graphql-subscriptions";
import { pubsub, EVENTS } from "../subscriptions/index.js";
import type { AgentManager } from "../agent-manager/index.js";

interface GoalView {
  id: string;
  name: string;
  status: string;
  retries: number;
  costUsd: number;
  error?: string;
}

interface ProjectView {
  id: string;
  name: string;
  path: string;
  phase: string;
  totalCost: number;
  spec: Spec | null;
  goals: GoalView[];
  interviewNotes: string[];
  isRunning: boolean;
  createdAt: string;
}

function getGoalViews(db: Database.Database, projectId: string): GoalView[] {
  const rows = db
    .prepare(
      "SELECT id, name, status, retries, cost_usd, error FROM goals WHERE project_id = ? ORDER BY rowid",
    )
    .all(projectId) as {
    id: string;
    name: string;
    status: string;
    retries: number;
    cost_usd: number;
    error: string | null;
  }[];

  return rows.map((r) => {
    const goal: GoalView = {
      id: r.id,
      name: r.name,
      status: r.status,
      retries: r.retries,
      costUsd: r.cost_usd,
    };
    if (r.error != null) goal.error = r.error;
    return goal;
  });
}

function projectToView(
  record: ProjectRecord,
  db: Database.Database,
  store: StateStore,
  runningIds: Set<string>,
): ProjectView {
  return {
    id: record.id,
    name: record.name,
    path: record.path,
    phase: store.getPhase(),
    totalCost: store.getTotalCost(),
    spec: store.getSpec(),
    goals: getGoalViews(db, record.id),
    interviewNotes: store.getInterviewNotes(),
    isRunning: runningIds.has(record.id),
    createdAt: record.createdAt,
  };
}

export function createResolvers(
  getDb: () => Database.Database,
  getRunningIds: () => Set<string>,
  agentManager?: AgentManager,
) {
  return {
    Query: {
      projects(): ProjectView[] {
        const db = getDb();
        const projectStore = new SQLiteProjectStore(db);
        const records = projectStore.listProjects();
        const runningIds = getRunningIds();
        return records.map((r) => {
          const store = new SQLiteStore(db, r.id);
          return projectToView(r, db, store, runningIds);
        });
      },

      project(_: unknown, args: { id: string }): ProjectView | null {
        const db = getDb();
        const projectStore = new SQLiteProjectStore(db);
        const record = projectStore.getProject(args.id);
        if (!record) return null;
        const store = new SQLiteStore(db, record.id);
        return projectToView(record, db, store, getRunningIds());
      },
    },

    Mutation: {
      createProject(
        _: unknown,
        args: { name: string; path: string },
      ): ProjectView {
        const db = getDb();
        const projectStore = new SQLiteProjectStore(db);
        const record = projectStore.createProject(args.name, args.path);
        const store = new SQLiteStore(db, record.id);
        return projectToView(record, db, store, getRunningIds());
      },

      deleteProject(_: unknown, args: { id: string }): boolean {
        const db = getDb();
        const projectStore = new SQLiteProjectStore(db);
        return projectStore.deleteProject(args.id);
      },

      startAgent(_: unknown, args: { projectId: string }): ProjectView {
        const db = getDb();
        const projectStore = new SQLiteProjectStore(db);
        const record = projectStore.getProject(args.projectId);
        if (!record) throw new Error(`Project ${args.projectId} not found`);
        if (agentManager) {
          agentManager.start(args.projectId, record.path);
        }
        const store = new SQLiteStore(db, record.id);
        return projectToView(record, db, store, getRunningIds());
      },

      stopAgent(_: unknown, args: { projectId: string }): ProjectView {
        const db = getDb();
        const projectStore = new SQLiteProjectStore(db);
        const record = projectStore.getProject(args.projectId);
        if (!record) throw new Error(`Project ${args.projectId} not found`);
        if (agentManager) {
          agentManager.stop(args.projectId);
        }
        const store = new SQLiteStore(db, record.id);
        return projectToView(record, db, store, getRunningIds());
      },
    },

    Subscription: {
      projectUpdated: {
        subscribe: withFilter(
          () => pubsub.asyncIterableIterator(EVENTS.PROJECT_UPDATED),
          (payload: any, variables: any) =>
            payload.projectUpdated.id === variables.projectId,
        ),
      },
      logEvent: {
        subscribe: withFilter(
          () => pubsub.asyncIterableIterator(EVENTS.LOG_EVENT),
          (payload: any, variables: any) =>
            payload.logEvent.projectId === variables.projectId,
        ),
      },
    },
  };
}

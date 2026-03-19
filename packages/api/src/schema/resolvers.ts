import {
  SQLiteProjectStore,
  SQLiteStore,
  type ProjectRecord,
  type StateStore,
  type GoalState,
  type Spec,
  type Message,
} from "@small-singularity/core";
import type Database from "better-sqlite3";
import { withFilter } from "graphql-subscriptions";
import { randomUUID } from "crypto";
import { homedir } from "os";
import { resolve } from "path";
import { mkdirSync } from "fs";
import { pubsub, EVENTS } from "../subscriptions/index.js";
import type { AgentManager } from "../agent-manager/index.js";

function resolvePath(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    p = p.replace("~", homedir());
  }
  return resolve(p);
}

interface GoalView {
  id: string;
  name: string;
  description: string;
  approach?: string;
  acceptanceCriteria: string[];
  dependsOn: string[];
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
      "SELECT id, name, description, approach, acceptance_criteria, depends_on, status, retries, cost_usd, error FROM goals WHERE project_id = ? ORDER BY rowid",
    )
    .all(projectId) as {
    id: string;
    name: string;
    description: string;
    approach: string | null;
    acceptance_criteria: string;
    depends_on: string;
    status: string;
    retries: number;
    cost_usd: number;
    error: string | null;
  }[];

  return rows.map((r) => {
    const goal: GoalView = {
      id: r.id,
      name: r.name,
      description: r.description,
      acceptanceCriteria: JSON.parse(r.acceptance_criteria) as string[],
      dependsOn: JSON.parse(r.depends_on) as string[],
      status: r.status,
      retries: r.retries,
      costUsd: r.cost_usd,
    };
    if (r.approach != null) goal.approach = r.approach;
    if (r.error != null) goal.error = r.error;
    return goal;
  });
}

function getGoalView(db: Database.Database, projectId: string, goalId: string): GoalView | null {
  const r = db
    .prepare(
      "SELECT id, name, description, approach, acceptance_criteria, depends_on, status, retries, cost_usd, error FROM goals WHERE project_id = ? AND id = ?",
    )
    .get(projectId, goalId) as {
    id: string;
    name: string;
    description: string;
    approach: string | null;
    acceptance_criteria: string;
    depends_on: string;
    status: string;
    retries: number;
    cost_usd: number;
    error: string | null;
  } | undefined;

  if (!r) return null;

  const goal: GoalView = {
    id: r.id,
    name: r.name,
    description: r.description,
    acceptanceCriteria: JSON.parse(r.acceptance_criteria) as string[],
    dependsOn: JSON.parse(r.depends_on) as string[],
    status: r.status,
    retries: r.retries,
    costUsd: r.cost_usd,
  };
  if (r.approach != null) goal.approach = r.approach;
  if (r.error != null) goal.error = r.error;
  return goal;
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

      messages(
        _: unknown,
        args: { projectId: string; limit?: number },
      ): Message[] {
        const db = getDb();
        const store = new SQLiteStore(db, args.projectId);
        return store.getMessages(args.limit ?? 100);
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
          const store = new SQLiteStore(db, record.id);
          const spec = store.getSpec();
          const phase = store.getPhase();
          const goalViews = getGoalViews(db, record.id);

          let systemPrompt = `You are an autonomous AI agent working on the project "${record.name}" at ${record.path}. Current phase: ${phase}.`;
          if (spec) {
            systemPrompt += `\n\nProject spec:\n${spec.overview}`;
          }
          if (goalViews.length > 0) {
            systemPrompt += `\n\nGoals:\n${goalViews.map((g) => `- ${g.name}: ${g.status}`).join("\n")}`;
          }

          const resolvedPath = resolvePath(record.path);
          mkdirSync(resolvedPath, { recursive: true });
          const goalDetails = goalViews
            .filter(g => g.status === "pending" || g.status === "active")
            .map(g => `- ${g.name}: ${g.description || "no description"}`)
            .join("\n");

          const initialMessage = goalViews.length > 0
            ? `Start working on the project. Here are the pending goals:\n${goalDetails}\n\nBegin with the first pending goal.`
            : "The project has no goals yet. Introduce yourself and ask what the user wants to build.";

          agentManager.start(args.projectId, resolvedPath, systemPrompt, initialMessage);
          return projectToView(record, db, store, getRunningIds());
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

      sendMessage(
        _: unknown,
        args: { projectId: string; content: string },
      ): Message {
        const db = getDb();
        const store = new SQLiteStore(db, args.projectId);
        const message = store.addMessage("user", args.content);

        // Push to live agent session if running
        if (agentManager) {
          try {
            agentManager.sendMessage(args.projectId, args.content);
          } catch {
            // Agent not running — message is stored for later
          }
        }

        pubsub.publish(EVENTS.NEW_MESSAGE, {
          newMessage: { ...message, projectId: args.projectId },
        });
        return message;
      },

      updateSpec(
        _: unknown,
        args: {
          projectId: string;
          overview: string;
          technicalDecisions: string[];
        },
      ): Spec {
        const db = getDb();
        const store = new SQLiteStore(db, args.projectId);
        store.updateSpec(args.overview, args.technicalDecisions);

        if (agentManager?.isRunning(args.projectId)) {
          try {
            agentManager.sendMessage(
              args.projectId,
              "[System] The user updated the spec. Please take note of the changes.",
            );
          } catch {}
        }

        return store.getSpec()!;
      },

      updateGoal(
        _: unknown,
        args: {
          projectId: string;
          goalId: string;
          name?: string;
          description?: string;
          approach?: string;
          acceptanceCriteria?: string[];
          dependsOn?: string[];
          status?: string;
        },
      ): GoalView {
        const db = getDb();
        const store = new SQLiteStore(db, args.projectId);

        const updates: Record<string, unknown> = {};
        if (args.name !== undefined) updates.name = args.name;
        if (args.description !== undefined) updates.description = args.description;
        if (args.approach !== undefined) updates.approach = args.approach;
        if (args.acceptanceCriteria !== undefined) updates.acceptanceCriteria = args.acceptanceCriteria;
        if (args.dependsOn !== undefined) updates.dependsOn = args.dependsOn;
        if (args.status !== undefined) updates.status = args.status;

        store.updateGoal(args.goalId, updates);

        if (agentManager?.isRunning(args.projectId)) {
          try {
            agentManager.sendMessage(
              args.projectId,
              `[System] Goal '${args.goalId}' was updated by the user. Please take note of the changes.`,
            );
          } catch {}
        }

        return getGoalView(db, args.projectId, args.goalId)!;
      },

      addGoal(
        _: unknown,
        args: {
          projectId: string;
          name: string;
          description: string;
          acceptanceCriteria: string[];
          dependsOn: string[];
        },
      ): GoalView {
        const db = getDb();
        const store = new SQLiteStore(db, args.projectId);
        const id = randomUUID();

        store.addGoal({
          id,
          name: args.name,
          description: args.description,
          acceptanceCriteria: args.acceptanceCriteria,
          dependsOn: args.dependsOn,
        });

        if (agentManager?.isRunning(args.projectId)) {
          try {
            agentManager.sendMessage(
              args.projectId,
              `[System] The user added a new goal '${args.name}'. Please take note of the changes.`,
            );
          } catch {}
        }

        return getGoalView(db, args.projectId, id)!;
      },

      refineGoal(
        _: unknown,
        args: { projectId: string; goalId: string },
      ): GoalView | null {
        const db = getDb();
        const row = db
          .prepare("SELECT id, name, description FROM goals WHERE project_id = ? AND id = ?")
          .get(args.projectId, args.goalId) as { id: string; name: string; description: string } | undefined;
        if (!row) throw new Error("Goal not found");

        if (agentManager?.isRunning(args.projectId)) {
          agentManager.sendMessage(
            args.projectId,
            `[System] A new goal needs refinement. Goal: "${row.name}". Description: "${row.description || "none"}".

Please interview the user about this goal to understand it better. Ask focused questions ONE AT A TIME:
- What specifically needs to happen?
- Are there constraints or preferences?
- What does "done" look like?
- Any technical considerations?

After you have enough information (3-5 questions), generate the following and respond with EXACTLY this JSON format:
\`\`\`json
{
  "criteria": ["criterion 1", "criterion 2", ...],
  "approach": "Brief technical approach description",
  "specUpdate": "Any updates to the project overview/spec"
}
\`\`\`

Start by asking your first question about this goal.`,
          );
        }

        // Update status to 'draft' to indicate refinement in progress
        const store = new SQLiteStore(db, args.projectId);
        store.updateGoal(args.goalId, { status: "draft" });

        // Return current goal state
        const goalViews = getGoalViews(db, args.projectId);
        return goalViews.find((g) => g.id === args.goalId) || null;
      },

      approveGoal(
        _: unknown,
        args: { projectId: string; goalId: string; startImmediately?: boolean },
      ): GoalView | null {
        const db = getDb();
        const store = new SQLiteStore(db, args.projectId);

        // Move from refined -> ready (or pending if startImmediately)
        const newStatus = args.startImmediately ? "pending" : "ready";
        store.updateGoal(args.goalId, { status: newStatus });

        // If startImmediately and agent is running, tell it to start
        if (args.startImmediately && agentManager?.isRunning(args.projectId)) {
          const row = db
            .prepare("SELECT name, description, approach FROM goals WHERE project_id = ? AND id = ?")
            .get(args.projectId, args.goalId) as { name: string; description: string; approach: string | null } | undefined;
          if (row) {
            agentManager.sendMessage(
              args.projectId,
              `[System] Goal "${row.name}" has been approved. Approach: ${row.approach || row.description}. Begin implementation now.`,
            );
          }
        }

        const goalViews = getGoalViews(db, args.projectId);
        return goalViews.find((g) => g.id === args.goalId) || null;
      },

      removeGoal(
        _: unknown,
        args: { projectId: string; goalId: string },
      ): boolean {
        const db = getDb();
        const store = new SQLiteStore(db, args.projectId);
        store.removeGoal(args.goalId);

        if (agentManager?.isRunning(args.projectId)) {
          try {
            agentManager.sendMessage(
              args.projectId,
              `[System] The user removed goal '${args.goalId}'. Please take note of the changes.`,
            );
          } catch {}
        }

        return true;
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
      newMessage: {
        subscribe: withFilter(
          () => pubsub.asyncIterableIterator(EVENTS.NEW_MESSAGE),
          (payload: any, variables: any) =>
            payload.newMessage.projectId === variables.projectId,
        ),
      },
    },
  };
}

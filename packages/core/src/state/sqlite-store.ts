import type Database from "better-sqlite3";
import type {
  PhaseName,
  Spec,
  SpecGoal,
  GoalState,
  GoalStatus,
} from "../core/types.js";
import type { StateStore, Message } from "./types.js";

export class SQLiteStore implements StateStore {
  private db: Database.Database;
  private projectId: string;

  constructor(db: Database.Database, projectId: string) {
    this.db = db;
    this.projectId = projectId;
  }

  // ── Project ──────────────────────────────────────────────

  getPhase(): PhaseName {
    const row = this.db
      .prepare("SELECT current_phase FROM project_state WHERE project_id = ?")
      .get(this.projectId) as { current_phase: string } | undefined;
    return (row?.current_phase ?? "interview") as PhaseName;
  }

  setPhase(phase: PhaseName): void {
    this.db
      .prepare(
        "UPDATE project_state SET current_phase = ?, updated_at = datetime('now') WHERE project_id = ?",
      )
      .run(phase, this.projectId);
  }

  getTotalCost(): number {
    const row = this.db
      .prepare("SELECT total_cost_usd FROM project_state WHERE project_id = ?")
      .get(this.projectId) as { total_cost_usd: number } | undefined;
    return row?.total_cost_usd ?? 0;
  }

  addCost(amount: number): void {
    this.db
      .prepare(
        "UPDATE project_state SET total_cost_usd = total_cost_usd + ?, updated_at = datetime('now') WHERE project_id = ?",
      )
      .run(amount, this.projectId);
  }

  // ── Interview ────────────────────────────────────────────

  getInterviewNotes(): string[] {
    const rows = this.db
      .prepare(
        "SELECT content FROM interview_notes WHERE project_id = ? ORDER BY id",
      )
      .all(this.projectId) as { content: string }[];
    return rows.map((r) => r.content);
  }

  addInterviewNote(note: string): void {
    this.db
      .prepare(
        "INSERT INTO interview_notes (project_id, content) VALUES (?, ?)",
      )
      .run(this.projectId, note);
  }

  // ── Spec ─────────────────────────────────────────────────

  getSpec(): Spec | null {
    const row = this.db
      .prepare("SELECT * FROM spec WHERE project_id = ?")
      .get(this.projectId) as
      | { overview: string; technical_decisions: string }
      | undefined;
    if (!row) return null;

    const goalRows = this.db
      .prepare(
        "SELECT id, name, description, acceptance_criteria, depends_on FROM goals WHERE project_id = ? ORDER BY rowid",
      )
      .all(this.projectId) as {
      id: string;
      name: string;
      description: string;
      acceptance_criteria: string;
      depends_on: string;
    }[];

    return {
      overview: row.overview,
      technicalDecisions: JSON.parse(row.technical_decisions) as string[],
      goals: goalRows.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        acceptanceCriteria: JSON.parse(g.acceptance_criteria) as string[],
        dependsOn: JSON.parse(g.depends_on) as string[],
      })),
    };
  }

  saveSpec(spec: Spec): void {
    const upsertSpec = this.db.prepare(
      "INSERT INTO spec (project_id, overview, technical_decisions) VALUES (?, ?, ?) " +
        "ON CONFLICT(project_id) DO UPDATE SET overview = excluded.overview, technical_decisions = excluded.technical_decisions",
    );

    const upsertGoal = this.db.prepare(
      "INSERT INTO goals (project_id, id, name, description, acceptance_criteria, depends_on) VALUES (?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(project_id, id) DO UPDATE SET name = excluded.name, description = excluded.description, " +
        "acceptance_criteria = excluded.acceptance_criteria, depends_on = excluded.depends_on",
    );

    const tx = this.db.transaction(() => {
      upsertSpec.run(
        this.projectId,
        spec.overview,
        JSON.stringify(spec.technicalDecisions),
      );
      for (const goal of spec.goals) {
        upsertGoal.run(
          this.projectId,
          goal.id,
          goal.name,
          goal.description,
          JSON.stringify(goal.acceptanceCriteria),
          JSON.stringify(goal.dependsOn),
        );
      }
    });

    tx();
  }

  // ── Goals ────────────────────────────────────────────────

  getGoals(): GoalState[] {
    const rows = this.db
      .prepare(
        "SELECT id, status, retries, cost_usd, error, session_id, approach, recurring FROM goals WHERE project_id = ? ORDER BY rowid",
      )
      .all(this.projectId) as {
      id: string;
      status: string;
      retries: number;
      cost_usd: number;
      error: string | null;
      session_id: string | null;
      approach: string | null;
      recurring: number;
    }[];

    return rows.map((r) => {
      const goal: GoalState = {
        id: r.id,
        status: r.status as GoalStatus,
        retries: r.retries,
        costUsd: r.cost_usd,
        recurring: !!r.recurring,
      };
      if (r.error != null) goal.error = r.error;
      if (r.session_id != null) goal.sessionId = r.session_id;
      if (r.approach != null) goal.approach = r.approach;
      return goal;
    });
  }

  getGoal(id: string): GoalState | null {
    const r = this.db
      .prepare(
        "SELECT id, status, retries, cost_usd, error, session_id, approach, recurring FROM goals WHERE project_id = ? AND id = ?",
      )
      .get(this.projectId, id) as
      | {
          id: string;
          status: string;
          retries: number;
          cost_usd: number;
          error: string | null;
          session_id: string | null;
          approach: string | null;
          recurring: number;
        }
      | undefined;

    if (!r) return null;

    const goal: GoalState = {
      id: r.id,
      status: r.status as GoalStatus,
      retries: r.retries,
      costUsd: r.cost_usd,
      recurring: !!r.recurring,
    };
    if (r.error != null) goal.error = r.error;
    if (r.session_id != null) goal.sessionId = r.session_id;
    if (r.approach != null) goal.approach = r.approach;
    return goal;
  }

  upsertGoal(goal: GoalState): void {
    this.db
      .prepare(
        "UPDATE goals SET status = ?, retries = ?, cost_usd = ?, error = ?, session_id = ? WHERE project_id = ? AND id = ?",
      )
      .run(
        goal.status,
        goal.retries,
        goal.costUsd,
        goal.error ?? null,
        goal.sessionId ?? null,
        this.projectId,
        goal.id,
      );
  }

  getNextPendingGoal(specGoals: SpecGoal[]): GoalState | null {
    const allGoals = this.getGoals();
    const statusMap = new Map<string, GoalStatus>();
    for (const g of allGoals) {
      statusMap.set(g.id, g.status);
    }

    for (const sg of specGoals) {
      const status = statusMap.get(sg.id) ?? "pending";
      if (status !== "pending" && status !== "retrying") continue;

      const depsResolved = sg.dependsOn.every((depId) => {
        const depStatus = statusMap.get(depId);
        return depStatus === "done" || depStatus === "skipped";
      });

      if (depsResolved) {
        return this.getGoal(sg.id);
      }
    }

    return null;
  }

  // ── Sessions ─────────────────────────────────────────────

  saveSession(phase: string, sessionId: string, goalId?: string): void {
    this.db
      .prepare(
        "INSERT INTO sessions (project_id, phase, session_id, goal_id) VALUES (?, ?, ?, ?)",
      )
      .run(this.projectId, phase, sessionId, goalId ?? null);
  }

  getLatestSession(phase: string, goalId?: string): string | null {
    let row: { session_id: string } | undefined;

    if (goalId != null) {
      row = this.db
        .prepare(
          "SELECT session_id FROM sessions WHERE project_id = ? AND phase = ? AND goal_id = ? ORDER BY id DESC LIMIT 1",
        )
        .get(this.projectId, phase, goalId) as
        | { session_id: string }
        | undefined;
    } else {
      row = this.db
        .prepare(
          "SELECT session_id FROM sessions WHERE project_id = ? AND phase = ? AND goal_id IS NULL ORDER BY id DESC LIMIT 1",
        )
        .get(this.projectId, phase) as { session_id: string } | undefined;
    }

    return row?.session_id ?? null;
  }

  // ── Messages ───────────────────────────────────────────

  getMessages(limit = 1000, beforeId?: number): Message[] {
    if (beforeId) {
      const rows = this.db
        .prepare(
          "SELECT * FROM (SELECT id, project_id, role, content, read, created_at FROM messages WHERE project_id = ? AND id < ? ORDER BY id DESC LIMIT ?) sub ORDER BY id ASC",
        )
        .all(this.projectId, beforeId, limit) as {
        id: number;
        project_id: string;
        role: string;
        content: string;
        read: number;
        created_at: string;
      }[];

      return rows.map((r) => ({
        id: r.id,
        projectId: r.project_id,
        role: r.role as "user" | "agent",
        content: r.content,
        read: r.read === 1,
        createdAt: r.created_at,
      }));
    }

    const rows = this.db
      .prepare(
        "SELECT * FROM (SELECT id, project_id, role, content, read, created_at FROM messages WHERE project_id = ? ORDER BY id DESC LIMIT ?) sub ORDER BY id ASC",
      )
      .all(this.projectId, limit) as {
      id: number;
      project_id: string;
      role: string;
      content: string;
      read: number;
      created_at: string;
    }[];

    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      role: r.role as "user" | "agent",
      content: r.content,
      read: r.read === 1,
      createdAt: r.created_at,
    }));
  }

  getUnreadMessages(): Message[] {
    const rows = this.db
      .prepare(
        "SELECT id, project_id, role, content, read, created_at FROM messages WHERE project_id = ? AND read = 0 ORDER BY created_at ASC",
      )
      .all(this.projectId) as {
      id: number;
      project_id: string;
      role: string;
      content: string;
      read: number;
      created_at: string;
    }[];

    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      role: r.role as "user" | "agent",
      content: r.content,
      read: r.read === 1,
      createdAt: r.created_at,
    }));
  }

  addMessage(role: "user" | "agent", content: string): Message {
    const result = this.db
      .prepare(
        "INSERT INTO messages (project_id, role, content) VALUES (?, ?, ?)",
      )
      .run(this.projectId, role, content);

    const row = this.db
      .prepare(
        "SELECT id, project_id, role, content, read, created_at FROM messages WHERE id = ?",
      )
      .get(result.lastInsertRowid) as {
      id: number;
      project_id: string;
      role: string;
      content: string;
      read: number;
      created_at: string;
    };

    return {
      id: row.id,
      projectId: row.project_id,
      role: row.role as "user" | "agent",
      content: row.content,
      read: row.read === 1,
      createdAt: row.created_at,
    };
  }

  markMessagesRead(): void {
    this.db
      .prepare(
        "UPDATE messages SET read = 1 WHERE project_id = ? AND read = 0",
      )
      .run(this.projectId);
  }

  // ── Rules ──────────────────────────────────────────────

  getRules(): { id: number; content: string }[] {
    const rows = this.db
      .prepare(
        "SELECT id, content FROM rules WHERE project_id = ? ORDER BY id ASC",
      )
      .all(this.projectId) as { id: number; content: string }[];
    return rows;
  }

  addRule(content: string): { id: number; content: string } {
    const result = this.db
      .prepare(
        "INSERT INTO rules (project_id, content) VALUES (?, ?)",
      )
      .run(this.projectId, content);
    return { id: Number(result.lastInsertRowid), content };
  }

  updateRule(id: number, content: string): void {
    this.db
      .prepare(
        "UPDATE rules SET content = ? WHERE project_id = ? AND id = ?",
      )
      .run(content, this.projectId, id);
  }

  removeRule(id: number): void {
    this.db
      .prepare(
        "DELETE FROM rules WHERE project_id = ? AND id = ?",
      )
      .run(this.projectId, id);
  }

  // ── Spec editing ────────────────────────────────────────

  updateSpec(overview: string, technicalDecisions: string[]): void {
    this.db
      .prepare(
        "UPDATE spec SET overview = ?, technical_decisions = ? WHERE project_id = ?",
      )
      .run(overview, JSON.stringify(technicalDecisions), this.projectId);
  }

  // ── Goal editing ──────────────────────────────────────

  updateGoal(
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      approach: string;
      acceptanceCriteria: string[];
      dependsOn: string[];
      status: string;
      recurring: boolean;
    }>,
  ): void {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      setClauses.push("name = ?");
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push("description = ?");
      values.push(updates.description);
    }
    if (updates.approach !== undefined) {
      setClauses.push("approach = ?");
      values.push(updates.approach);
    }
    if (updates.acceptanceCriteria !== undefined) {
      setClauses.push("acceptance_criteria = ?");
      values.push(JSON.stringify(updates.acceptanceCriteria));
    }
    if (updates.dependsOn !== undefined) {
      setClauses.push("depends_on = ?");
      values.push(JSON.stringify(updates.dependsOn));
    }
    if (updates.status !== undefined) {
      setClauses.push("status = ?");
      values.push(updates.status);
    }
    if (updates.recurring !== undefined) {
      setClauses.push("recurring = ?");
      values.push(updates.recurring ? 1 : 0);
    }

    if (setClauses.length === 0) return;

    values.push(this.projectId, id);
    this.db
      .prepare(
        `UPDATE goals SET ${setClauses.join(", ")} WHERE project_id = ? AND id = ?`,
      )
      .run(...values);
  }

  addGoal(goal: {
    id: string;
    name: string;
    description: string;
    acceptanceCriteria: string[];
    dependsOn: string[];
    approach?: string;
    recurring?: boolean;
  }): void {
    this.db
      .prepare(
        "INSERT INTO goals (project_id, id, name, description, approach, acceptance_criteria, depends_on, status, retries, cost_usd, recurring) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 0, 0, ?)",
      )
      .run(
        this.projectId,
        goal.id,
        goal.name,
        goal.description,
        goal.approach ?? null,
        JSON.stringify(goal.acceptanceCriteria),
        JSON.stringify(goal.dependsOn),
        goal.recurring ? 1 : 0,
      );
  }

  removeGoal(id: string): void {
    this.db
      .prepare("DELETE FROM goals WHERE project_id = ? AND id = ?")
      .run(this.projectId, id);
  }

  // ── Activity ─────────────────────────────────────────────

  getActivityEvents(limit = 100, beforeId?: number): { id: number; type: string; message: string; costUsd: number | null; createdAt: string }[] {
    if (beforeId) {
      const rows = this.db
        .prepare(
          "SELECT * FROM (SELECT id, type, message, cost_usd, created_at FROM activity_events WHERE project_id = ? AND id < ? ORDER BY id DESC LIMIT ?) sub ORDER BY id ASC",
        )
        .all(this.projectId, beforeId, limit) as {
        id: number;
        type: string;
        message: string;
        cost_usd: number | null;
        created_at: string;
      }[];

      return rows.map((r) => ({
        id: r.id,
        type: r.type,
        message: r.message,
        costUsd: r.cost_usd,
        createdAt: r.created_at,
      }));
    }

    const rows = this.db
      .prepare(
        "SELECT * FROM (SELECT id, type, message, cost_usd, created_at FROM activity_events WHERE project_id = ? ORDER BY id DESC LIMIT ?) sub ORDER BY id ASC",
      )
      .all(this.projectId, limit) as {
      id: number;
      type: string;
      message: string;
      cost_usd: number | null;
      created_at: string;
    }[];

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      message: r.message,
      costUsd: r.cost_usd,
      createdAt: r.created_at,
    }));
  }

  addActivityEvent(type: string, message: string, costUsd?: number): void {
    this.db
      .prepare(
        "INSERT INTO activity_events (project_id, type, message, cost_usd) VALUES (?, ?, ?, ?)",
      )
      .run(this.projectId, type, message, costUsd ?? null);
  }

  // ── Checkpoints ─────────────────────────────────────────

  getCheckpoints(limit = 50): { id: number; goalId: string | null; goalName: string; commitHash: string; tag: string; message: string; createdAt: string }[] {
    const rows = this.db
      .prepare(
        "SELECT id, goal_id, goal_name, commit_hash, tag, message, created_at FROM checkpoints WHERE project_id = ? ORDER BY id DESC LIMIT ?",
      )
      .all(this.projectId, limit) as {
      id: number;
      goal_id: string | null;
      goal_name: string;
      commit_hash: string;
      tag: string;
      message: string;
      created_at: string;
    }[];

    return rows.map((r) => ({
      id: r.id,
      goalId: r.goal_id,
      goalName: r.goal_name,
      commitHash: r.commit_hash,
      tag: r.tag,
      message: r.message,
      createdAt: r.created_at,
    }));
  }

  addCheckpoint(goalId: string | null, goalName: string, commitHash: string, tag: string, message: string): void {
    this.db
      .prepare(
        "INSERT INTO checkpoints (project_id, goal_id, goal_name, commit_hash, tag, message) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(this.projectId, goalId, goalName, commitHash, tag, message);
  }

  // ── Run Commands ─────────────────────────────────────────

  getRunCommands(): { id: number; name: string; command: string; autoStart: boolean }[] {
    const rows = this.db
      .prepare(
        "SELECT id, name, command, auto_start FROM run_commands WHERE project_id = ? ORDER BY id ASC",
      )
      .all(this.projectId) as { id: number; name: string; command: string; auto_start: number }[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      command: r.command,
      autoStart: r.auto_start === 1,
    }));
  }

  addRunCommand(name: string, command: string): { id: number; name: string; command: string; autoStart: boolean } {
    const result = this.db
      .prepare(
        "INSERT INTO run_commands (project_id, name, command) VALUES (?, ?, ?)",
      )
      .run(this.projectId, name, command);
    return { id: Number(result.lastInsertRowid), name, command, autoStart: false };
  }

  updateRunCommand(id: number, updates: Partial<{ name: string; command: string; autoStart: boolean }>): void {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      setClauses.push("name = ?");
      values.push(updates.name);
    }
    if (updates.command !== undefined) {
      setClauses.push("command = ?");
      values.push(updates.command);
    }
    if (updates.autoStart !== undefined) {
      setClauses.push("auto_start = ?");
      values.push(updates.autoStart ? 1 : 0);
    }

    if (setClauses.length === 0) return;

    values.push(this.projectId, id);
    this.db
      .prepare(
        `UPDATE run_commands SET ${setClauses.join(", ")} WHERE project_id = ? AND id = ?`,
      )
      .run(...values);
  }

  removeRunCommand(id: number): void {
    this.db
      .prepare("DELETE FROM run_commands WHERE project_id = ? AND id = ?")
      .run(this.projectId, id);
  }

  // ── Environment Variables ─────────────────────────────────

  getEnvVars(): { id: number; key: string; value: string }[] {
    const rows = this.db
      .prepare(
        "SELECT id, key, value FROM env_vars WHERE project_id = ? ORDER BY id ASC",
      )
      .all(this.projectId) as { id: number; key: string; value: string }[];
    return rows;
  }

  setEnvVar(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO env_vars (project_id, key, value) VALUES (?, ?, ?)",
      )
      .run(this.projectId, key, value);
  }

  removeEnvVar(id: number): void {
    this.db
      .prepare("DELETE FROM env_vars WHERE project_id = ? AND id = ?")
      .run(this.projectId, id);
  }

  // ── Goal Screenshots ─────────────────────────────────────

  getGoalScreenshots(goalId: string): { id: number; filePath: string; fileName: string }[] {
    const rows = this.db
      .prepare(
        "SELECT id, file_path, file_name FROM goal_screenshots WHERE project_id = ? AND goal_id = ? ORDER BY id ASC",
      )
      .all(this.projectId, goalId) as { id: number; file_path: string; file_name: string }[];
    return rows.map((r) => ({
      id: r.id,
      filePath: r.file_path,
      fileName: r.file_name,
    }));
  }

  addGoalScreenshot(goalId: string, filePath: string, fileName: string): { id: number; filePath: string; fileName: string } {
    const result = this.db
      .prepare(
        "INSERT INTO goal_screenshots (project_id, goal_id, file_path, file_name) VALUES (?, ?, ?, ?)",
      )
      .run(this.projectId, goalId, filePath, fileName);
    return { id: Number(result.lastInsertRowid), filePath, fileName };
  }

  removeGoalScreenshot(id: number): void {
    this.db
      .prepare("DELETE FROM goal_screenshots WHERE project_id = ? AND id = ?")
      .run(this.projectId, id);
  }

  // ── Lifecycle ────────────────────────────────────────────

  close(): void {
    this.db.close();
  }
}

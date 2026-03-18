import type Database from "better-sqlite3";
import type { PhaseName, Spec, SpecGoal, GoalState, GoalStatus } from "../core/types.js";
import type { StateStore } from "./types.js";

export class SQLiteStore implements StateStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ── Project ──────────────────────────────────────────────

  getPhase(): PhaseName {
    const row = this.db
      .prepare("SELECT current_phase FROM project WHERE id = 1")
      .get() as { current_phase: string } | undefined;
    return (row?.current_phase ?? "interview") as PhaseName;
  }

  setPhase(phase: PhaseName): void {
    this.db
      .prepare(
        "UPDATE project SET current_phase = ?, updated_at = datetime('now') WHERE id = 1",
      )
      .run(phase);
  }

  getTotalCost(): number {
    const row = this.db
      .prepare("SELECT total_cost_usd FROM project WHERE id = 1")
      .get() as { total_cost_usd: number } | undefined;
    return row?.total_cost_usd ?? 0;
  }

  addCost(amount: number): void {
    this.db
      .prepare(
        "UPDATE project SET total_cost_usd = total_cost_usd + ?, updated_at = datetime('now') WHERE id = 1",
      )
      .run(amount);
  }

  // ── Interview ────────────────────────────────────────────

  getInterviewNotes(): string[] {
    const rows = this.db
      .prepare("SELECT content FROM interview_notes ORDER BY id")
      .all() as { content: string }[];
    return rows.map((r) => r.content);
  }

  addInterviewNote(note: string): void {
    this.db
      .prepare("INSERT INTO interview_notes (content) VALUES (?)")
      .run(note);
  }

  // ── Spec ─────────────────────────────────────────────────

  getSpec(): Spec | null {
    const row = this.db.prepare("SELECT * FROM spec WHERE id = 1").get() as
      | { overview: string; technical_decisions: string }
      | undefined;
    if (!row) return null;

    const goalRows = this.db
      .prepare(
        "SELECT id, name, description, acceptance_criteria, depends_on FROM goals ORDER BY rowid",
      )
      .all() as {
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
      "INSERT INTO spec (id, overview, technical_decisions) VALUES (1, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET overview = excluded.overview, technical_decisions = excluded.technical_decisions",
    );

    const upsertGoal = this.db.prepare(
      "INSERT INTO goals (id, name, description, acceptance_criteria, depends_on) VALUES (?, ?, ?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, " +
        "acceptance_criteria = excluded.acceptance_criteria, depends_on = excluded.depends_on",
    );

    const tx = this.db.transaction(() => {
      upsertSpec.run(
        spec.overview,
        JSON.stringify(spec.technicalDecisions),
      );
      for (const goal of spec.goals) {
        upsertGoal.run(
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
        "SELECT id, status, retries, cost_usd, error, session_id FROM goals ORDER BY rowid",
      )
      .all() as {
      id: string;
      status: string;
      retries: number;
      cost_usd: number;
      error: string | null;
      session_id: string | null;
    }[];

    return rows.map((r) => {
      const goal: GoalState = {
        id: r.id,
        status: r.status as GoalStatus,
        retries: r.retries,
        costUsd: r.cost_usd,
      };
      if (r.error != null) goal.error = r.error;
      if (r.session_id != null) goal.sessionId = r.session_id;
      return goal;
    });
  }

  getGoal(id: string): GoalState | null {
    const r = this.db
      .prepare(
        "SELECT id, status, retries, cost_usd, error, session_id FROM goals WHERE id = ?",
      )
      .get(id) as
      | {
          id: string;
          status: string;
          retries: number;
          cost_usd: number;
          error: string | null;
          session_id: string | null;
        }
      | undefined;

    if (!r) return null;

    const goal: GoalState = {
      id: r.id,
      status: r.status as GoalStatus,
      retries: r.retries,
      costUsd: r.cost_usd,
    };
    if (r.error != null) goal.error = r.error;
    if (r.session_id != null) goal.sessionId = r.session_id;
    return goal;
  }

  upsertGoal(goal: GoalState): void {
    this.db
      .prepare(
        "UPDATE goals SET status = ?, retries = ?, cost_usd = ?, error = ?, session_id = ? WHERE id = ?",
      )
      .run(
        goal.status,
        goal.retries,
        goal.costUsd,
        goal.error ?? null,
        goal.sessionId ?? null,
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
        "INSERT INTO sessions (phase, session_id, goal_id) VALUES (?, ?, ?)",
      )
      .run(phase, sessionId, goalId ?? null);
  }

  getLatestSession(phase: string, goalId?: string): string | null {
    let row: { session_id: string } | undefined;

    if (goalId != null) {
      row = this.db
        .prepare(
          "SELECT session_id FROM sessions WHERE phase = ? AND goal_id = ? ORDER BY id DESC LIMIT 1",
        )
        .get(phase, goalId) as { session_id: string } | undefined;
    } else {
      row = this.db
        .prepare(
          "SELECT session_id FROM sessions WHERE phase = ? AND goal_id IS NULL ORDER BY id DESC LIMIT 1",
        )
        .get(phase) as { session_id: string } | undefined;
    }

    return row?.session_id ?? null;
  }

  // ── Lifecycle ────────────────────────────────────────────

  close(): void {
    this.db.close();
  }
}

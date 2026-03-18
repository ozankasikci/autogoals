import type { GoalState, GoalStatus, SpecGoal } from "../../core/types.js";
import type { StateStore } from "../state/index.js";

export class GoalTracker {
  private store: StateStore;
  private specGoals: SpecGoal[];
  private maxRetries: number;

  constructor(store: StateStore, specGoals: SpecGoal[], maxRetries: number) {
    this.store = store;
    this.specGoals = specGoals;
    this.maxRetries = maxRetries;

    // Seed any spec goals that aren't already in the store
    for (const sg of specGoals) {
      const existing = store.getGoal(sg.id);
      if (!existing) {
        store.upsertGoal({
          id: sg.id,
          status: "pending",
          retries: 0,
          costUsd: 0,
        });
      }
    }
  }

  get(id: string): GoalState | undefined {
    return this.store.getGoal(id) ?? undefined;
  }

  getAll(): GoalState[] {
    return this.store.getGoals();
  }

  getNextPending(): GoalState | undefined {
    return this.store.getNextPendingGoal(this.specGoals) ?? undefined;
  }

  start(id: string): void {
    const goal = this.mustGet(id);
    goal.status = "active";
    this.store.upsertGoal(goal);
  }

  startVerifying(id: string): void {
    const goal = this.mustGet(id);
    goal.status = "verifying";
    this.store.upsertGoal(goal);
  }

  complete(id: string, costUsd: number): void {
    const goal = this.mustGet(id);
    goal.status = "done";
    goal.costUsd += costUsd;
    this.store.upsertGoal(goal);
  }

  fail(id: string, error: string, costUsd: number = 0): void {
    const goal = this.mustGet(id);
    goal.status = "failed";
    goal.error = error;
    goal.costUsd += costUsd;
    this.store.upsertGoal(goal);
  }

  canRetry(id: string): boolean {
    const goal = this.mustGet(id);
    return goal.retries < this.maxRetries;
  }

  retry(id: string): void {
    const goal = this.mustGet(id);
    goal.retries += 1;
    goal.status = "retrying";
    this.store.upsertGoal(goal);
  }

  skip(id: string): void {
    const goal = this.mustGet(id);
    goal.status = "skipped";
    this.store.upsertGoal(goal);
  }

  isAllDone(): boolean {
    return this.getAll().every(
      (g) => g.status === "done" || g.status === "skipped"
    );
  }

  totalCost(): number {
    return this.getAll().reduce((sum, g) => sum + g.costUsd, 0);
  }

  private mustGet(id: string): GoalState {
    const goal = this.store.getGoal(id);
    if (!goal) throw new Error(`Unknown goal: ${id}`);
    return goal;
  }
}

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

  fail(id: string, error: string, costUsd: number = 0): void {
    const goal = this.mustGet(id);
    goal.status = "failed";
    goal.error = error;
    goal.costUsd += costUsd;
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

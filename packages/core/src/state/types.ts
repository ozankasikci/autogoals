import type { PhaseName, Spec, SpecGoal, GoalState } from "../core/types.js";

export interface StateStore {
  // Project
  getPhase(): PhaseName;
  setPhase(phase: PhaseName): void;
  getTotalCost(): number;
  addCost(amount: number): void;

  // Interview
  getInterviewNotes(): string[];
  addInterviewNote(note: string): void;

  // Spec
  getSpec(): Spec | null;
  saveSpec(spec: Spec): void;

  // Goals
  getGoals(): GoalState[];
  getGoal(id: string): GoalState | null;
  upsertGoal(goal: GoalState): void;
  getNextPendingGoal(specGoals: SpecGoal[]): GoalState | null;

  // Sessions
  saveSession(phase: string, sessionId: string, goalId?: string): void;
  getLatestSession(phase: string, goalId?: string): string | null;

  // Lifecycle
  close(): void;
}

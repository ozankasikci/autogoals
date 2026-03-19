import type { StateStore } from "../state/index.js";

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
  | "draft"
  | "refined"
  | "ready"
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
  approach?: string;
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
  store: StateStore;
  projectPath: string;
  spec: Spec | null;
}

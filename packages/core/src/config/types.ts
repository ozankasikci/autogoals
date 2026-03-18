import type { AgentConfig, BudgetConfig } from "../core/types.js";

export interface ConfigInput {
  projectPath: string;
  model?: string;
  budget?: Partial<BudgetConfig>;
  maxRetriesPerGoal?: number;
  verbose?: boolean;
}

export type { AgentConfig };

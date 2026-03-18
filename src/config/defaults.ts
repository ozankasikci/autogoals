import type { AgentConfig } from "../core/types.js";

export const DEFAULT_CONFIG: Omit<AgentConfig, "projectPath"> = {
  model: "sonnet",
  budget: {
    maxPerGoal: 2.0,
    maxTotal: 20.0,
    warningThreshold: 0.8,
  },
  maxRetriesPerGoal: 2,
  verbose: false,
};

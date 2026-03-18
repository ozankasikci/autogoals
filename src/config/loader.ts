import type { AgentConfig } from "../core/types.js";
import type { ConfigInput } from "./types.js";
import { DEFAULT_CONFIG } from "./defaults.js";

export function loadConfig(input: ConfigInput): AgentConfig {
  if (!input.projectPath) {
    throw new Error("projectPath is required");
  }

  return {
    projectPath: input.projectPath,
    model: input.model ?? DEFAULT_CONFIG.model,
    budget: {
      ...DEFAULT_CONFIG.budget,
      ...input.budget,
    },
    maxRetriesPerGoal:
      input.maxRetriesPerGoal ?? DEFAULT_CONFIG.maxRetriesPerGoal,
    verbose: input.verbose ?? DEFAULT_CONFIG.verbose,
  };
}

import type { SpecGoal } from "../../core/types.js";
import { runQuery } from "../../sdk/index.js";
import { EXECUTION_TOOLS } from "../../sdk/tool-config.js";
import { buildVerificationPrompt } from "./planner.js";

export interface VerificationResult {
  passed: boolean;
  reason: string;
  costUsd: number;
}

export async function verifyGoal(
  goal: SpecGoal,
  projectPath: string,
  model: string
): Promise<VerificationResult> {
  const prompt = buildVerificationPrompt(goal);

  const result = await runQuery({
    prompt,
    allowedTools: EXECUTION_TOOLS,
    cwd: projectPath,
    model,
    maxTurns: 20,
  });

  const text = result?.text ?? "";
  const passed = text.includes("VERIFIED");
  const reason = passed
    ? "All acceptance criteria met"
    : text.replace(/^FAILED:\s*/i, "").trim() || "Verification failed";

  return {
    passed,
    reason,
    costUsd: result?.costUsd ?? 0,
  };
}

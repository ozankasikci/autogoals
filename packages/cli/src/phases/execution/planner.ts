import type { SpecGoal } from "@small-singularity/core";

export function buildExecutionPrompt(
  goal: SpecGoal,
  completedGoalSummaries: string[]
): string {
  const context =
    completedGoalSummaries.length > 0
      ? `\n\nAlready completed:\n${completedGoalSummaries.map((s) => `- ${s}`).join("\n")}`
      : "";

  return `You are implementing a specific goal in a project. Work autonomously until the goal is complete.

## Goal: ${goal.name}

${goal.description}

## Acceptance Criteria
${goal.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}
${context}

## Rules
- Implement this goal completely
- Write tests where applicable
- Run tests to verify they pass
- Do NOT work on other goals
- When done, summarize what you built`;
}

export function buildVerificationPrompt(goal: SpecGoal): string {
  return `You are reviewing whether a goal has been properly implemented. Do NOT make changes — only verify.

## Goal: ${goal.name}

## Acceptance Criteria to verify:
${goal.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}

Check each criterion:
1. Run any existing tests
2. Review the code for each criterion
3. Try running the feature if possible

Respond with:
- VERIFIED: if all criteria are met
- FAILED: [reason] if any criterion is not met`;
}

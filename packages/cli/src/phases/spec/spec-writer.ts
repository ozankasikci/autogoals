import type { Spec } from "@autogoals/core";

export function renderSpec(spec: Spec): string {
  const lines: string[] = [];

  lines.push("# Project Spec");
  lines.push("");
  lines.push("## Overview");
  lines.push("");
  lines.push(spec.overview);
  lines.push("");
  lines.push("## Goals");
  lines.push("");

  for (const goal of spec.goals) {
    lines.push(`### Goal ${goal.id}: ${goal.name}`);
    lines.push("");
    lines.push(goal.description);
    lines.push("");
    lines.push("**Acceptance Criteria:**");
    for (const criterion of goal.acceptanceCriteria) {
      lines.push(`- ${criterion}`);
    }
    if (goal.dependsOn.length > 0) {
      lines.push("");
      lines.push(`**Depends on:** ${goal.dependsOn.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("## Technical Decisions");
  lines.push("");
  for (const decision of spec.technicalDecisions) {
    lines.push(`- ${decision}`);
  }
  lines.push("");

  return lines.join("\n");
}

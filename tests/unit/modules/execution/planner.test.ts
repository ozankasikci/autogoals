import { describe, it, expect } from "vitest";
import {
  buildExecutionPrompt,
  buildVerificationPrompt,
} from "../../../../src/modules/execution/planner.js";
import type { SpecGoal } from "../../../../src/core/types.js";

const goal: SpecGoal = {
  id: "1",
  name: "Set up auth",
  description: "Add NextAuth with GitHub OAuth",
  acceptanceCriteria: ["Users can sign in", "Users can sign out"],
  dependsOn: [],
};

describe("execution planner", () => {
  it("builds execution prompt with goal details", () => {
    const prompt = buildExecutionPrompt(goal, []);
    expect(prompt).toContain("Set up auth");
    expect(prompt).toContain("NextAuth with GitHub OAuth");
    expect(prompt).toContain("Users can sign in");
  });

  it("includes completed goals as context", () => {
    const prompt = buildExecutionPrompt(goal, ["Project scaffolding done"]);
    expect(prompt).toContain("Project scaffolding done");
  });

  it("builds verification prompt", () => {
    const prompt = buildVerificationPrompt(goal);
    expect(prompt).toContain("Users can sign in");
    expect(prompt).toContain("verify");
  });
});

import { describe, it, expect } from "vitest";
import type {
  Phase,
  PhaseResult,
  PhaseName,
  AgentContext,
  AgentConfig,
  BudgetConfig,
} from "../../../src/core/types.js";

describe("core types", () => {
  it("PhaseName includes all four phases plus done", () => {
    const names: PhaseName[] = [
      "interview",
      "spec",
      "execution",
      "standby",
      "done",
    ];
    expect(names).toHaveLength(5);
  });

  it("PhaseResult has next and optional data", () => {
    const result: PhaseResult = { next: "spec" };
    expect(result.next).toBe("spec");

    const resultWithData: PhaseResult = {
      next: "execution",
      data: { foo: "bar" },
    };
    expect(resultWithData.data).toEqual({ foo: "bar" });
  });

  it("BudgetConfig has required fields", () => {
    const budget: BudgetConfig = {
      maxPerGoal: 2.0,
      maxTotal: 20.0,
      warningThreshold: 0.8,
    };
    expect(budget.maxPerGoal).toBe(2.0);
  });
});

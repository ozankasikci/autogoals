import { describe, it, expect } from "vitest";
import { buildStandbyPrompt } from "../../../../src/phases/standby/index.js";
import type { Spec } from "@small-singularity/core";

describe("standby", () => {
  it("builds standby prompt with spec summary", () => {
    const spec: Spec = {
      overview: "A todo app",
      goals: [
        {
          id: "1",
          name: "Setup",
          description: "Init project",
          acceptanceCriteria: ["works"],
          dependsOn: [],
        },
      ],
      technicalDecisions: ["Next.js"],
    };

    const prompt = buildStandbyPrompt(spec, ["1: Setup - done"], ["$1.50"]);
    expect(prompt).toContain("todo app");
    expect(prompt).toContain("Setup");
    expect(prompt).toContain("new goals");
  });
});

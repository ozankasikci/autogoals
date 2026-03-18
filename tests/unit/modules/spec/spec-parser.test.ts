import { describe, it, expect } from "vitest";
import { parseSpec, renderSpec } from "../../../../src/modules/spec/index.js";
import type { Spec } from "../../../../src/core/types.js";

const sampleSpec: Spec = {
  overview: "A todo app with auth",
  goals: [
    {
      id: "1",
      name: "Set up project",
      description: "Initialize Next.js with TypeScript",
      acceptanceCriteria: ["npm run dev starts successfully"],
      dependsOn: [],
    },
    {
      id: "2",
      name: "Add auth",
      description: "Set up NextAuth with GitHub OAuth",
      acceptanceCriteria: ["Users can sign in", "Users can sign out"],
      dependsOn: ["1"],
    },
  ],
  technicalDecisions: ["Next.js 14", "NextAuth", "Prisma"],
};

describe("spec parser", () => {
  it("renders a spec to markdown", () => {
    const md = renderSpec(sampleSpec);
    expect(md).toContain("# Project Spec");
    expect(md).toContain("A todo app with auth");
    expect(md).toContain("Set up project");
    expect(md).toContain("Add auth");
    expect(md).toContain("npm run dev starts successfully");
    expect(md).toContain("Next.js 14");
  });

  it("parses a rendered spec back to object", () => {
    const md = renderSpec(sampleSpec);
    const parsed = parseSpec(md);
    expect(parsed.overview).toContain("todo app");
    expect(parsed.goals).toHaveLength(2);
    expect(parsed.goals[0].name).toBe("Set up project");
    expect(parsed.goals[1].dependsOn).toContain("1");
  });
});

import { describe, it, expect } from "vitest";
import { buildInterviewPrompt } from "../../../../src/modules/interview/index.js";

describe("interview question builder", () => {
  it("includes project scan instruction for new projects", () => {
    const prompt = buildInterviewPrompt({ existingFiles: [], userDescription: "build a todo app" });
    expect(prompt).toContain("todo app");
    expect(prompt).toContain("one question at a time");
  });

  it("includes existing file context for existing projects", () => {
    const prompt = buildInterviewPrompt({
      existingFiles: ["package.json", "src/index.ts"],
      userDescription: "add auth",
    });
    expect(prompt).toContain("package.json");
    expect(prompt).toContain("add auth");
  });
});

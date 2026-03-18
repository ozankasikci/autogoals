import { describe, it, expect } from "vitest";
import { loadConfig } from "../../../src/config/index.js";
import { DEFAULT_CONFIG } from "../../../src/config/defaults.js";

describe("config loader", () => {
  it("returns defaults when no overrides given", () => {
    const config = loadConfig({ projectPath: "/tmp/test" });
    expect(config.model).toBe(DEFAULT_CONFIG.model);
    expect(config.budget.maxTotal).toBe(DEFAULT_CONFIG.budget.maxTotal);
    expect(config.projectPath).toBe("/tmp/test");
  });

  it("overrides individual fields", () => {
    const config = loadConfig({
      projectPath: "/tmp/test",
      model: "haiku",
      budget: { maxPerGoal: 5, maxTotal: 50, warningThreshold: 0.9 },
    });
    expect(config.model).toBe("haiku");
    expect(config.budget.maxTotal).toBe(50);
  });

  it("requires projectPath", () => {
    expect(() => loadConfig({} as any)).toThrow();
  });
});

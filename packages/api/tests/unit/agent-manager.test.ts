import { describe, it, expect } from "vitest";
import { AgentManager } from "../../src/agent-manager/index.js";

describe("AgentManager", () => {
  it("isRunning returns false initially", () => {
    const manager = new AgentManager();
    expect(manager.isRunning("project-1")).toBe(false);
  });

  it("getRunningIds returns empty set initially", () => {
    const manager = new AgentManager();
    expect(manager.getRunningIds()).toEqual(new Set());
  });
});

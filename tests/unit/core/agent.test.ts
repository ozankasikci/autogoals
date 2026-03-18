import { describe, it, expect, vi } from "vitest";
import { Agent } from "../../../src/core/agent.js";
import type { Phase, PhaseResult, AgentContext } from "../../../src/core/types.js";
import { createInitialState } from "../../../src/modules/state/index.js";
import { loadConfig } from "../../../src/config/index.js";
import { createLogger } from "../../../src/modules/logging/index.js";

function mockPhase(name: string, next: string): Phase {
  return {
    name: name as any,
    execute: vi.fn().mockResolvedValue({ next } as PhaseResult),
  };
}

describe("Agent", () => {
  it("transitions through phases until done", async () => {
    const interview = mockPhase("interview", "spec");
    const spec = mockPhase("spec", "execution");
    const execution = mockPhase("execution", "standby");
    const standby = mockPhase("standby", "done");

    const agent = new Agent({
      interview,
      spec,
      execution,
      standby,
    });

    const config = loadConfig({ projectPath: "/tmp/test" });
    const state = createInitialState();
    const logger = createLogger({ sink: () => {} });

    await agent.run({
      config,
      state,
      projectPath: "/tmp/test",
      spec: null,
    }, logger);

    expect(interview.execute).toHaveBeenCalledOnce();
    expect(spec.execute).toHaveBeenCalledOnce();
    expect(execution.execute).toHaveBeenCalledOnce();
    expect(standby.execute).toHaveBeenCalledOnce();
  });

  it("can skip phases based on phase result", async () => {
    const interview = mockPhase("interview", "execution");
    const spec = mockPhase("spec", "done");
    const execution = mockPhase("execution", "done");
    const standby = mockPhase("standby", "done");

    const agent = new Agent({ interview, spec, execution, standby });

    const config = loadConfig({ projectPath: "/tmp/test" });
    const state = createInitialState();
    const logger = createLogger({ sink: () => {} });

    await agent.run({
      config,
      state,
      projectPath: "/tmp/test",
      spec: null,
    }, logger);

    expect(interview.execute).toHaveBeenCalledOnce();
    expect(spec.execute).not.toHaveBeenCalled();
    expect(execution.execute).toHaveBeenCalledOnce();
    expect(standby.execute).not.toHaveBeenCalled();
  });
});

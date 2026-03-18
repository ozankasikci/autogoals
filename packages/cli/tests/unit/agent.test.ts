import { describe, it, expect, vi } from "vitest";
import Database from "better-sqlite3";
import { Agent } from "../../src/agent.js";
import type { Phase, PhaseResult, AgentContext } from "@small-singularity/core";
import { SQLiteStore, SQLiteProjectStore, SCHEMA_SQL, loadConfig, createLogger } from "@small-singularity/core";
import type { StateStore } from "@small-singularity/core";

function createMemoryStore(): StateStore {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);
  const projectStore = new SQLiteProjectStore(db);
  const project = projectStore.createProject("test", "/tmp/test");
  return new SQLiteStore(db, project.id);
}

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
    const store = createMemoryStore();
    const logger = createLogger({ sink: () => {} });

    await agent.run({
      config,
      store,
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
    const store = createMemoryStore();
    const logger = createLogger({ sink: () => {} });

    await agent.run({
      config,
      store,
      projectPath: "/tmp/test",
      spec: null,
    }, logger);

    expect(interview.execute).toHaveBeenCalledOnce();
    expect(spec.execute).not.toHaveBeenCalled();
    expect(execution.execute).toHaveBeenCalledOnce();
    expect(standby.execute).not.toHaveBeenCalled();
  });
});

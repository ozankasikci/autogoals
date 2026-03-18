import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { Agent } from "../../src/agent.js";
import { GoalTracker, SQLiteStore, SCHEMA_SQL, loadConfig, createLogger } from "@small-singularity/core";
import type { StateStore, Phase, PhaseResult } from "@small-singularity/core";
import { parseSpec } from "../../src/phases/spec/index.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function createMemoryStore(): StateStore {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);
  return new SQLiteStore(db);
}

describe("agent flow integration", () => {
  it("transitions through all phases with mock phases", async () => {
    const transitions: string[] = [];

    const mockPhase = (name: string, next: string): Phase => ({
      name: name as any,
      execute: async () => {
        transitions.push(name);
        return { next } as PhaseResult;
      },
    });

    const agent = new Agent({
      interview: mockPhase("interview", "spec"),
      spec: mockPhase("spec", "execution"),
      execution: mockPhase("execution", "standby"),
      standby: mockPhase("standby", "done"),
    });

    const config = loadConfig({ projectPath: "/tmp/test" });
    const store = createMemoryStore();
    const logger = createLogger({ sink: () => {} });

    await agent.run({ config, store, projectPath: "/tmp/test", spec: null }, logger);

    expect(transitions).toEqual(["interview", "spec", "execution", "standby"]);
  });

  it("parses sample spec fixture", () => {
    const fixturePath = join(__dirname, "../fixtures/sample-spec.md");
    const md = readFileSync(fixturePath, "utf-8");
    const spec = parseSpec(md);

    expect(spec.overview).toContain("hello world");
    expect(spec.goals).toHaveLength(1);
    expect(spec.goals[0].name).toBe("Create main file");
    expect(spec.goals[0].acceptanceCriteria).toContain(
      'Running the file prints "Hello, World!"'
    );
  });

  it("goal tracker works with parsed spec goals", () => {
    const fixturePath = join(__dirname, "../fixtures/sample-spec.md");
    const md = readFileSync(fixturePath, "utf-8");
    const spec = parseSpec(md);

    const store = createMemoryStore();
    store.saveSpec(spec);

    const tracker = new GoalTracker(store, spec.goals, 2);
    expect(tracker.getNextPending()?.id).toBe("1");

    tracker.start("1");
    tracker.startVerifying("1");
    tracker.complete("1", 0.25);

    expect(tracker.isAllDone()).toBe(true);
    expect(tracker.totalCost()).toBe(0.25);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { GoalTracker } from "../../../../src/modules/goals/index.js";
import { SQLiteStore } from "../../../../src/modules/state/index.js";
import { SCHEMA_SQL } from "../../../../src/modules/state/index.js";
import type { SpecGoal } from "../../../../src/core/types.js";
import type { StateStore } from "../../../../src/modules/state/index.js";

const makeGoal = (id: string, deps: string[] = []): SpecGoal => ({
  id,
  name: `Goal ${id}`,
  description: `Description for ${id}`,
  acceptanceCriteria: [`${id} works`],
  dependsOn: deps,
});

function createMemoryStore(specGoals: SpecGoal[]): StateStore {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);
  const store = new SQLiteStore(db);
  // Save a spec so goals rows exist in the DB
  store.saveSpec({
    overview: "test",
    technicalDecisions: [],
    goals: specGoals,
  });
  return store;
}

describe("GoalTracker", () => {
  it("initializes goals from spec goals", () => {
    const specGoals = [makeGoal("1"), makeGoal("2")];
    const store = createMemoryStore(specGoals);
    const tracker = new GoalTracker(store, specGoals, 2);
    expect(tracker.getAll()).toHaveLength(2);
    expect(tracker.getAll()[0].status).toBe("pending");
  });

  it("returns next goal that has no unmet dependencies", () => {
    const specGoals = [makeGoal("1"), makeGoal("2", ["1"])];
    const store = createMemoryStore(specGoals);
    const tracker = new GoalTracker(store, specGoals, 2);
    const next = tracker.getNextPending();
    expect(next?.id).toBe("1");
  });

  it("transitions goal through lifecycle", () => {
    const specGoals = [makeGoal("1")];
    const store = createMemoryStore(specGoals);
    const tracker = new GoalTracker(store, specGoals, 2);

    tracker.start("1");
    expect(tracker.get("1")!.status).toBe("active");

    tracker.startVerifying("1");
    expect(tracker.get("1")!.status).toBe("verifying");

    tracker.complete("1", 0.5);
    expect(tracker.get("1")!.status).toBe("done");
    expect(tracker.get("1")!.costUsd).toBe(0.5);
  });

  it("retries failed goal up to max retries then skips", () => {
    const specGoals = [makeGoal("1")];
    const store = createMemoryStore(specGoals);
    const tracker = new GoalTracker(store, specGoals, 2);

    tracker.start("1");
    tracker.fail("1", "first error");
    expect(tracker.get("1")!.status).toBe("failed");

    tracker.retry("1");
    expect(tracker.get("1")!.status).toBe("retrying");
    expect(tracker.get("1")!.retries).toBe(1);

    tracker.start("1");
    tracker.fail("1", "second error");
    tracker.retry("1");
    expect(tracker.get("1")!.retries).toBe(2);

    tracker.start("1");
    tracker.fail("1", "third error");
    const canRetry = tracker.canRetry("1");
    expect(canRetry).toBe(false);

    tracker.skip("1");
    expect(tracker.get("1")!.status).toBe("skipped");
  });

  it("reports all done when every goal is done or skipped", () => {
    const specGoals = [makeGoal("1"), makeGoal("2")];
    const store = createMemoryStore(specGoals);
    const tracker = new GoalTracker(store, specGoals, 2);

    tracker.start("1");
    tracker.startVerifying("1");
    tracker.complete("1", 0.3);

    tracker.skip("2");

    expect(tracker.isAllDone()).toBe(true);
  });

  it("computes total cost", () => {
    const specGoals = [makeGoal("1"), makeGoal("2")];
    const store = createMemoryStore(specGoals);
    const tracker = new GoalTracker(store, specGoals, 2);

    tracker.start("1");
    tracker.startVerifying("1");
    tracker.complete("1", 1.2);

    tracker.start("2");
    tracker.startVerifying("2");
    tracker.complete("2", 0.8);

    expect(tracker.totalCost()).toBe(2.0);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../../../src/state/migrations.js";
import { SQLiteStore } from "../../../src/state/sqlite-store.js";
import { SQLiteProjectStore } from "../../../src/state/project-store.js";
import type { StateStore } from "../../../src/state/types.js";
import type { Spec } from "../../../src/core/types.js";

describe("SQLiteStore edit operations", () => {
  let store: StateStore;
  let db: Database.Database;
  let projectId: string;

  const sampleSpec: Spec = {
    overview: "A sample project",
    technicalDecisions: ["Use TypeScript", "Use SQLite"],
    goals: [
      {
        id: "g1",
        name: "Setup",
        description: "Initialize project",
        acceptanceCriteria: ["Has package.json"],
        dependsOn: [],
      },
      {
        id: "g2",
        name: "Database",
        description: "Add database support",
        acceptanceCriteria: ["Can read/write"],
        dependsOn: ["g1"],
      },
    ],
  };

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(SCHEMA_SQL);
    const projectStore = new SQLiteProjectStore(db);
    const project = projectStore.createProject("test-project", "/tmp/test");
    projectId = project.id;
    store = new SQLiteStore(db, projectId);
    store.saveSpec(sampleSpec);
  });

  afterEach(() => {
    store.close();
  });

  // ── updateSpec ──────────────────────────────────────────

  describe("updateSpec", () => {
    it("updates overview and technical decisions", () => {
      store.updateSpec("Updated overview", ["Decision A", "Decision B"]);
      const spec = store.getSpec();
      expect(spec).not.toBeNull();
      expect(spec!.overview).toBe("Updated overview");
      expect(spec!.technicalDecisions).toEqual(["Decision A", "Decision B"]);
    });

    it("preserves goals when updating spec", () => {
      store.updateSpec("New overview", []);
      const spec = store.getSpec();
      expect(spec!.goals).toHaveLength(2);
      expect(spec!.goals[0].id).toBe("g1");
      expect(spec!.goals[1].id).toBe("g2");
    });
  });

  // ── updateGoal ──────────────────────────────────────────

  describe("updateGoal", () => {
    it("updates goal name only", () => {
      store.updateGoal("g1", { name: "New Name" });
      const spec = store.getSpec();
      expect(spec!.goals[0].name).toBe("New Name");
      expect(spec!.goals[0].description).toBe("Initialize project");
    });

    it("updates goal description only", () => {
      store.updateGoal("g1", { description: "Updated description" });
      const spec = store.getSpec();
      expect(spec!.goals[0].description).toBe("Updated description");
      expect(spec!.goals[0].name).toBe("Setup");
    });

    it("updates acceptance criteria", () => {
      store.updateGoal("g1", {
        acceptanceCriteria: ["Criterion A", "Criterion B"],
      });
      const spec = store.getSpec();
      expect(spec!.goals[0].acceptanceCriteria).toEqual([
        "Criterion A",
        "Criterion B",
      ]);
    });

    it("updates dependsOn", () => {
      store.updateGoal("g1", { dependsOn: ["g2"] });
      const spec = store.getSpec();
      expect(spec!.goals[0].dependsOn).toEqual(["g2"]);
    });

    it("updates status", () => {
      store.updateGoal("g1", { status: "done" });
      const goal = store.getGoal("g1");
      expect(goal!.status).toBe("done");
    });

    it("updates multiple fields at once", () => {
      store.updateGoal("g1", {
        name: "Renamed",
        description: "New desc",
        acceptanceCriteria: ["New criterion"],
      });
      const spec = store.getSpec();
      expect(spec!.goals[0].name).toBe("Renamed");
      expect(spec!.goals[0].description).toBe("New desc");
      expect(spec!.goals[0].acceptanceCriteria).toEqual(["New criterion"]);
    });

    it("does nothing when updates is empty", () => {
      store.updateGoal("g1", {});
      const spec = store.getSpec();
      expect(spec!.goals[0].name).toBe("Setup");
    });
  });

  // ── addGoal ─────────────────────────────────────────────

  describe("addGoal", () => {
    it("adds a new goal with pending status", () => {
      store.addGoal({
        id: "g3",
        name: "New Goal",
        description: "A new goal",
        acceptanceCriteria: ["Acceptance 1"],
        dependsOn: ["g1"],
      });

      const spec = store.getSpec();
      expect(spec!.goals).toHaveLength(3);
      expect(spec!.goals[2].id).toBe("g3");
      expect(spec!.goals[2].name).toBe("New Goal");
      expect(spec!.goals[2].description).toBe("A new goal");
      expect(spec!.goals[2].acceptanceCriteria).toEqual(["Acceptance 1"]);
      expect(spec!.goals[2].dependsOn).toEqual(["g1"]);

      const goalState = store.getGoal("g3");
      expect(goalState).not.toBeNull();
      expect(goalState!.status).toBe("pending");
      expect(goalState!.retries).toBe(0);
      expect(goalState!.costUsd).toBe(0);
    });
  });

  // ── removeGoal ──────────────────────────────────────────

  describe("removeGoal", () => {
    it("removes an existing goal", () => {
      store.removeGoal("g2");
      const spec = store.getSpec();
      expect(spec!.goals).toHaveLength(1);
      expect(spec!.goals[0].id).toBe("g1");
    });

    it("does not error when removing a non-existent goal", () => {
      expect(() => store.removeGoal("nonexistent")).not.toThrow();
    });

    it("goal is no longer retrievable after removal", () => {
      store.removeGoal("g1");
      const goal = store.getGoal("g1");
      expect(goal).toBeNull();
    });
  });
});

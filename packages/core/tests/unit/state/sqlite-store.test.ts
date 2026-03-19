import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../../../src/state/migrations.js";
import { SQLiteStore } from "../../../src/state/sqlite-store.js";
import { SQLiteProjectStore } from "../../../src/state/project-store.js";
import type { StateStore } from "../../../src/state/types.js";
import type { Spec, SpecGoal } from "../../../src/core/types.js";

describe("SQLiteStore", () => {
  let store: StateStore;
  let db: Database.Database;
  let projectId: string;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(SCHEMA_SQL);
    // Create a project first so project_state row exists
    const projectStore = new SQLiteProjectStore(db);
    const project = projectStore.createProject("test-project", "/tmp/test");
    projectId = project.id;
    store = new SQLiteStore(db, projectId);
  });

  afterEach(() => {
    store.close();
  });

  // ── Phase ──────────────────────────────────────────────

  it("returns 'interview' as the default phase", () => {
    expect(store.getPhase()).toBe("interview");
  });

  it("sets and gets the phase", () => {
    store.setPhase("execution");
    expect(store.getPhase()).toBe("execution");

    store.setPhase("done");
    expect(store.getPhase()).toBe("done");
  });

  // ── Cost ───────────────────────────────────────────────

  it("returns 0 as the default total cost", () => {
    expect(store.getTotalCost()).toBe(0);
  });

  it("accumulates cost", () => {
    store.addCost(1.5);
    expect(store.getTotalCost()).toBe(1.5);

    store.addCost(0.75);
    expect(store.getTotalCost()).toBeCloseTo(2.25);
  });

  // ── Interview notes ────────────────────────────────────

  it("returns empty array when no interview notes exist", () => {
    expect(store.getInterviewNotes()).toEqual([]);
  });

  it("adds and retrieves interview notes in order", () => {
    store.addInterviewNote("User wants a CLI tool");
    store.addInterviewNote("Should support TypeScript");

    const notes = store.getInterviewNotes();
    expect(notes).toEqual([
      "User wants a CLI tool",
      "Should support TypeScript",
    ]);
  });

  // ── Spec ───────────────────────────────────────────────

  it("returns null when no spec exists", () => {
    expect(store.getSpec()).toBeNull();
  });

  it("saves and retrieves a spec with goals", () => {
    const spec: Spec = {
      overview: "A CLI tool for managing projects",
      technicalDecisions: ["Use TypeScript", "Use SQLite for state"],
      goals: [
        {
          id: "goal-1",
          name: "Setup project",
          description: "Initialize the project structure",
          acceptanceCriteria: ["Has package.json", "Has tsconfig.json"],
          dependsOn: [],
        },
        {
          id: "goal-2",
          name: "Add database",
          description: "Add SQLite database support",
          acceptanceCriteria: ["Can read/write state"],
          dependsOn: ["goal-1"],
        },
      ],
    };

    store.saveSpec(spec);
    const loaded = store.getSpec();

    expect(loaded).not.toBeNull();
    expect(loaded!.overview).toBe("A CLI tool for managing projects");
    expect(loaded!.technicalDecisions).toEqual([
      "Use TypeScript",
      "Use SQLite for state",
    ]);
    expect(loaded!.goals).toHaveLength(2);
    expect(loaded!.goals[0].id).toBe("goal-1");
    expect(loaded!.goals[0].acceptanceCriteria).toEqual([
      "Has package.json",
      "Has tsconfig.json",
    ]);
    expect(loaded!.goals[1].dependsOn).toEqual(["goal-1"]);
  });

  // ── Goals ──────────────────────────────────────────────

  it("returns empty array when no goals exist", () => {
    expect(store.getGoals()).toEqual([]);
  });

  it("returns null for a non-existent goal", () => {
    expect(store.getGoal("nonexistent")).toBeNull();
  });

  it("retrieves goals after saving a spec", () => {
    const spec: Spec = {
      overview: "Test",
      technicalDecisions: [],
      goals: [
        {
          id: "g1",
          name: "Goal 1",
          description: "First goal",
          acceptanceCriteria: ["Done"],
          dependsOn: [],
        },
      ],
    };

    store.saveSpec(spec);
    const goals = store.getGoals();

    expect(goals).toHaveLength(1);
    expect(goals[0].id).toBe("g1");
    expect(goals[0].status).toBe("draft");
    expect(goals[0].retries).toBe(0);
    expect(goals[0].costUsd).toBe(0);
  });

  it("upserts goal state", () => {
    const spec: Spec = {
      overview: "Test",
      technicalDecisions: [],
      goals: [
        {
          id: "g1",
          name: "Goal 1",
          description: "First goal",
          acceptanceCriteria: ["Done"],
          dependsOn: [],
        },
      ],
    };

    store.saveSpec(spec);
    store.upsertGoal({
      id: "g1",
      status: "active",
      retries: 1,
      costUsd: 0.5,
      error: "Something went wrong",
      sessionId: "sess-123",
    });

    const goal = store.getGoal("g1");
    expect(goal).not.toBeNull();
    expect(goal!.status).toBe("active");
    expect(goal!.retries).toBe(1);
    expect(goal!.costUsd).toBe(0.5);
    expect(goal!.error).toBe("Something went wrong");
    expect(goal!.sessionId).toBe("sess-123");
  });

  // ── getNextPendingGoal ─────────────────────────────────

  it("returns first pending goal when no dependencies", () => {
    const specGoals: SpecGoal[] = [
      {
        id: "g1",
        name: "Goal 1",
        description: "First",
        acceptanceCriteria: [],
        dependsOn: [],
      },
      {
        id: "g2",
        name: "Goal 2",
        description: "Second",
        acceptanceCriteria: [],
        dependsOn: [],
      },
    ];

    const spec: Spec = {
      overview: "Test",
      technicalDecisions: [],
      goals: specGoals,
    };
    store.saveSpec(spec);
    // Goals default to 'draft'; set to 'pending' so getNextPendingGoal finds them
    store.upsertGoal({ id: "g1", status: "pending", retries: 0, costUsd: 0 });
    store.upsertGoal({ id: "g2", status: "pending", retries: 0, costUsd: 0 });

    const next = store.getNextPendingGoal(specGoals);
    expect(next).not.toBeNull();
    expect(next!.id).toBe("g1");
  });

  it("does not return a goal whose dependencies are not met", () => {
    const specGoals: SpecGoal[] = [
      {
        id: "g1",
        name: "Goal 1",
        description: "First",
        acceptanceCriteria: [],
        dependsOn: [],
      },
      {
        id: "g2",
        name: "Goal 2",
        description: "Second",
        acceptanceCriteria: [],
        dependsOn: ["g1"],
      },
    ];

    const spec: Spec = {
      overview: "Test",
      technicalDecisions: [],
      goals: specGoals,
    };
    store.saveSpec(spec);
    // Set g2 to pending so it would be eligible if deps were met
    store.upsertGoal({ id: "g2", status: "pending", retries: 0, costUsd: 0 });

    // Mark g1 as active (not done yet)
    store.upsertGoal({ id: "g1", status: "active", retries: 0, costUsd: 0 });

    const next = store.getNextPendingGoal(specGoals);
    // g1 is active (not pending/retrying), g2 depends on g1 which isn't done
    expect(next).toBeNull();
  });

  it("returns dependent goal once dependency is done", () => {
    const specGoals: SpecGoal[] = [
      {
        id: "g1",
        name: "Goal 1",
        description: "First",
        acceptanceCriteria: [],
        dependsOn: [],
      },
      {
        id: "g2",
        name: "Goal 2",
        description: "Second",
        acceptanceCriteria: [],
        dependsOn: ["g1"],
      },
    ];

    const spec: Spec = {
      overview: "Test",
      technicalDecisions: [],
      goals: specGoals,
    };
    store.saveSpec(spec);
    // Set g2 to pending so getNextPendingGoal can find it
    store.upsertGoal({ id: "g2", status: "pending", retries: 0, costUsd: 0 });

    // Mark g1 as done
    store.upsertGoal({ id: "g1", status: "done", retries: 0, costUsd: 0.1 });

    const next = store.getNextPendingGoal(specGoals);
    expect(next).not.toBeNull();
    expect(next!.id).toBe("g2");
  });

  it("returns dependent goal when dependency is skipped", () => {
    const specGoals: SpecGoal[] = [
      {
        id: "g1",
        name: "Goal 1",
        description: "First",
        acceptanceCriteria: [],
        dependsOn: [],
      },
      {
        id: "g2",
        name: "Goal 2",
        description: "Second",
        acceptanceCriteria: [],
        dependsOn: ["g1"],
      },
    ];

    const spec: Spec = {
      overview: "Test",
      technicalDecisions: [],
      goals: specGoals,
    };
    store.saveSpec(spec);
    // Set g2 to pending so getNextPendingGoal can find it
    store.upsertGoal({ id: "g2", status: "pending", retries: 0, costUsd: 0 });

    store.upsertGoal({
      id: "g1",
      status: "skipped",
      retries: 0,
      costUsd: 0,
    });

    const next = store.getNextPendingGoal(specGoals);
    expect(next).not.toBeNull();
    expect(next!.id).toBe("g2");
  });

  it("returns retrying goal as next pending", () => {
    const specGoals: SpecGoal[] = [
      {
        id: "g1",
        name: "Goal 1",
        description: "First",
        acceptanceCriteria: [],
        dependsOn: [],
      },
    ];

    const spec: Spec = {
      overview: "Test",
      technicalDecisions: [],
      goals: specGoals,
    };
    store.saveSpec(spec);

    store.upsertGoal({
      id: "g1",
      status: "retrying",
      retries: 1,
      costUsd: 0.2,
    });

    const next = store.getNextPendingGoal(specGoals);
    expect(next).not.toBeNull();
    expect(next!.id).toBe("g1");
  });

  it("does not return draft goals as pending", () => {
    const specGoals: SpecGoal[] = [
      {
        id: "g1",
        name: "Goal 1",
        description: "First",
        acceptanceCriteria: [],
        dependsOn: [],
      },
    ];

    const spec: Spec = {
      overview: "Test",
      technicalDecisions: [],
      goals: specGoals,
    };
    store.saveSpec(spec);
    // g1 defaults to 'draft', should not be returned by getNextPendingGoal
    const next = store.getNextPendingGoal(specGoals);
    expect(next).toBeNull();
  });

  it("returns null when all goals are done", () => {
    const specGoals: SpecGoal[] = [
      {
        id: "g1",
        name: "Goal 1",
        description: "First",
        acceptanceCriteria: [],
        dependsOn: [],
      },
    ];

    const spec: Spec = {
      overview: "Test",
      technicalDecisions: [],
      goals: specGoals,
    };
    store.saveSpec(spec);
    store.upsertGoal({ id: "g1", status: "done", retries: 0, costUsd: 0.1 });

    const next = store.getNextPendingGoal(specGoals);
    expect(next).toBeNull();
  });

  // ── Sessions ───────────────────────────────────────────

  it("returns null when no session exists", () => {
    expect(store.getLatestSession("interview")).toBeNull();
  });

  it("saves and retrieves sessions", () => {
    store.saveSession("interview", "sess-1");
    store.saveSession("interview", "sess-2");

    const latest = store.getLatestSession("interview");
    expect(latest).toBe("sess-2");
  });

  it("saves and retrieves sessions with goalId", () => {
    store.saveSession("execution", "sess-a", "g1");
    store.saveSession("execution", "sess-b", "g1");
    store.saveSession("execution", "sess-c", "g2");

    expect(store.getLatestSession("execution", "g1")).toBe("sess-b");
    expect(store.getLatestSession("execution", "g2")).toBe("sess-c");
  });

  it("distinguishes sessions with and without goalId", () => {
    store.saveSession("execution", "sess-no-goal");
    store.saveSession("execution", "sess-with-goal", "g1");

    expect(store.getLatestSession("execution")).toBe("sess-no-goal");
    expect(store.getLatestSession("execution", "g1")).toBe("sess-with-goal");
  });

  // ── Project isolation ─────────────────────────────────

  it("isolates data between projects", () => {
    // Create a second project
    const projectStore = new SQLiteProjectStore(db);
    const project2 = projectStore.createProject("other", "/tmp/other");
    const store2 = new SQLiteStore(db, project2.id);

    store.addInterviewNote("Note for project 1");
    store2.addInterviewNote("Note for project 2");

    expect(store.getInterviewNotes()).toEqual(["Note for project 1"]);
    expect(store2.getInterviewNotes()).toEqual(["Note for project 2"]);

    // Don't close store2 separately since they share the same db
  });

  // ── Close ──────────────────────────────────────────────

  it("closes the database without error", () => {
    // close is called in afterEach, but let's verify it works explicitly
    store.close();
    // Re-create so afterEach doesn't fail on double-close
    db = new Database(":memory:");
    db.exec(SCHEMA_SQL);
    const projectStore = new SQLiteProjectStore(db);
    const project = projectStore.createProject("test-project-2", "/tmp/test2");
    store = new SQLiteStore(db, project.id);
  });
});

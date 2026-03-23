import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { SCHEMA_SQL, SQLiteStore } from "@autogoals/core";
import { createResolvers } from "../../src/schema/resolvers.js";

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);
  return db;
}

describe("resolvers", () => {
  let db: Database.Database;
  let resolvers: ReturnType<typeof createResolvers>;

  beforeEach(() => {
    db = createTestDb();
    resolvers = createResolvers(
      () => db,
      () => new Set(),
    );
  });

  afterEach(() => {
    db.close();
  });

  describe("Query", () => {
    it("projects returns empty list initially", () => {
      const result = resolvers.Query.projects();
      expect(result).toEqual([]);
    });

    it("project returns null for unknown id", () => {
      const result = resolvers.Query.project(null, { id: "unknown" });
      expect(result).toBeNull();
    });
  });

  describe("Mutation", () => {
    it("createProject creates and returns a project", () => {
      const result = resolvers.Mutation.createProject(null, {
        name: "test",
        path: "/tmp/test",
      });
      expect(result.name).toBe("test");
      expect(result.path).toBe("/tmp/test");
      expect(result.phase).toBe("interview");
      expect(result.isRunning).toBe(false);
    });

    it("deleteProject removes a project", () => {
      const project = resolvers.Mutation.createProject(null, {
        name: "test",
        path: "/tmp/test",
      });
      const deleted = resolvers.Mutation.deleteProject(null, {
        id: project.id,
      });
      expect(deleted).toBe(true);
      const found = resolvers.Query.project(null, { id: project.id });
      expect(found).toBeNull();
    });
  });

  describe("Spec and Goal editing", () => {
    function createProjectWithSpec() {
      const project = resolvers.Mutation.createProject(null, {
        name: "test",
        path: "/tmp/test-edit",
      });
      // Save a spec with goals using SQLiteStore directly
      const store = new SQLiteStore(db, project.id);
      store.saveSpec({
        overview: "Original overview",
        technicalDecisions: ["Use TypeScript"],
        goals: [
          {
            id: "g1",
            name: "Goal 1",
            description: "First goal",
            acceptanceCriteria: ["Done"],
            dependsOn: [],
          },
          {
            id: "g2",
            name: "Goal 2",
            description: "Second goal",
            acceptanceCriteria: ["Complete"],
            dependsOn: ["g1"],
          },
        ],
      });
      return project;
    }

    it("updateSpec updates overview and technical decisions", () => {
      const project = createProjectWithSpec();
      const result = resolvers.Mutation.updateSpec(null, {
        projectId: project.id,
        overview: "Updated overview",
        technicalDecisions: ["Decision A", "Decision B"],
      });
      expect(result.overview).toBe("Updated overview");
      expect(result.technicalDecisions).toEqual(["Decision A", "Decision B"]);
      expect(result.goals).toHaveLength(2);
    });

    it("updateGoal updates a single field", () => {
      const project = createProjectWithSpec();
      const result = resolvers.Mutation.updateGoal(null, {
        projectId: project.id,
        goalId: "g1",
        name: "Renamed Goal",
      });
      expect(result.id).toBe("g1");
      expect(result.name).toBe("Renamed Goal");
      expect(result.description).toBe("First goal");
    });

    it("updateGoal updates multiple fields", () => {
      const project = createProjectWithSpec();
      const result = resolvers.Mutation.updateGoal(null, {
        projectId: project.id,
        goalId: "g1",
        name: "New Name",
        description: "New Desc",
        acceptanceCriteria: ["A", "B"],
      });
      expect(result.name).toBe("New Name");
      expect(result.description).toBe("New Desc");
      expect(result.acceptanceCriteria).toEqual(["A", "B"]);
    });

    it("addGoal creates a new goal with generated ID", () => {
      const project = createProjectWithSpec();
      const result = resolvers.Mutation.addGoal(null, {
        projectId: project.id,
        name: "New Goal",
        description: "A brand new goal",
        acceptanceCriteria: ["Criterion 1"],
        dependsOn: ["g1"],
      });
      expect(result.id).toBeDefined();
      expect(result.name).toBe("New Goal");
      expect(result.description).toBe("A brand new goal");
      expect(result.acceptanceCriteria).toEqual(["Criterion 1"]);
      expect(result.dependsOn).toEqual(["g1"]);
      expect(result.status).toBe("draft");
      expect(result.retries).toBe(0);
      expect(result.costUsd).toBe(0);
    });

    it("removeGoal removes a goal and returns true", () => {
      const project = createProjectWithSpec();
      const result = resolvers.Mutation.removeGoal(null, {
        projectId: project.id,
        goalId: "g2",
      });
      expect(result).toBe(true);

      // Verify goal is gone
      const proj = resolvers.Query.project(null, { id: project.id });
      expect(proj!.goals).toHaveLength(1);
      expect(proj!.goals[0].id).toBe("g1");
    });
  });

  describe("Messages", () => {
    it("messages returns empty list initially", () => {
      const project = resolvers.Mutation.createProject(null, {
        name: "test",
        path: "/tmp/test",
      });
      const messages = resolvers.Query.messages(null, {
        projectId: project.id,
      });
      expect(messages).toEqual([]);
    });

    it("sendMessage creates a message and returns it", () => {
      const project = resolvers.Mutation.createProject(null, {
        name: "test",
        path: "/tmp/test",
      });
      const message = resolvers.Mutation.sendMessage(null, {
        projectId: project.id,
        content: "hello",
      });
      expect(message.role).toBe("user");
      expect(message.content).toBe("hello");
      expect(message.read).toBe(false);
      expect(message.id).toBeDefined();
      expect(message.createdAt).toBeDefined();
    });

    it("messages returns sent messages", () => {
      const project = resolvers.Mutation.createProject(null, {
        name: "test",
        path: "/tmp/test",
      });
      resolvers.Mutation.sendMessage(null, {
        projectId: project.id,
        content: "first",
      });
      resolvers.Mutation.sendMessage(null, {
        projectId: project.id,
        content: "second",
      });
      const messages = resolvers.Query.messages(null, {
        projectId: project.id,
      });
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("first");
      expect(messages[1].content).toBe("second");
    });
  });
});

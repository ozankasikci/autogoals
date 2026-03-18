import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "@small-singularity/core";
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
});

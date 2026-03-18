import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../../../src/state/migrations.js";
import { SQLiteProjectStore } from "../../../src/state/project-store.js";
import type { ProjectStore } from "../../../src/state/types.js";

describe("SQLiteProjectStore", () => {
  let store: ProjectStore;
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(SCHEMA_SQL);
    store = new SQLiteProjectStore(db);
  });

  afterEach(() => {
    store.close();
  });

  it("createProject returns a record with id, name, path", () => {
    const project = store.createProject("my-project", "/tmp/my-project");
    expect(project.id).toBeTruthy();
    expect(project.name).toBe("my-project");
    expect(project.path).toBe("/tmp/my-project");
    expect(project.createdAt).toBeTruthy();
    expect(project.updatedAt).toBeTruthy();
  });

  it("listProjects returns all projects", () => {
    store.createProject("proj-a", "/tmp/proj-a");
    store.createProject("proj-b", "/tmp/proj-b");

    const projects = store.listProjects();
    expect(projects).toHaveLength(2);
    const names = projects.map((p) => p.name);
    expect(names).toContain("proj-a");
    expect(names).toContain("proj-b");
  });

  it("getProject returns project by id", () => {
    const created = store.createProject("test", "/tmp/test");
    const found = store.getProject(created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.name).toBe("test");
    expect(found!.path).toBe("/tmp/test");
  });

  it("getProject returns null for non-existent id", () => {
    expect(store.getProject("non-existent")).toBeNull();
  });

  it("getProjectByPath returns project by path", () => {
    const created = store.createProject("test", "/tmp/test");
    const found = store.getProjectByPath("/tmp/test");
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  it("getProjectByPath returns null for non-existent path", () => {
    expect(store.getProjectByPath("/no/such/path")).toBeNull();
  });

  it("deleteProject removes project and all related data", () => {
    const project = store.createProject("doomed", "/tmp/doomed");

    // Verify project_state was also created
    const stateRow = db
      .prepare("SELECT * FROM project_state WHERE project_id = ?")
      .get(project.id);
    expect(stateRow).toBeTruthy();

    const deleted = store.deleteProject(project.id);
    expect(deleted).toBe(true);

    expect(store.getProject(project.id)).toBeNull();

    // Verify project_state was also removed
    const stateRowAfter = db
      .prepare("SELECT * FROM project_state WHERE project_id = ?")
      .get(project.id);
    expect(stateRowAfter).toBeUndefined();
  });

  it("deleteProject returns false for non-existent id", () => {
    expect(store.deleteProject("non-existent")).toBe(false);
  });

  it("duplicate path throws UNIQUE constraint error", () => {
    store.createProject("first", "/tmp/unique-path");
    expect(() => store.createProject("second", "/tmp/unique-path")).toThrow();
  });

  it("closes the database without error", () => {
    store.close();
    // Re-create so afterEach doesn't fail on double-close
    db = new Database(":memory:");
    db.exec(SCHEMA_SQL);
    store = new SQLiteProjectStore(db);
  });
});

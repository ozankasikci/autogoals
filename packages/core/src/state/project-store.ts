import type Database from "better-sqlite3";
import { randomUUID } from "crypto";
import type { ProjectRecord, ProjectStore } from "./types.js";

export class SQLiteProjectStore implements ProjectStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  createProject(name: string, path: string): ProjectRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO projects (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, name, path, now, now);
    // Also create the project_state row
    this.db
      .prepare("INSERT INTO project_state (project_id) VALUES (?)")
      .run(id);
    return { id, name, path, createdAt: now, updatedAt: now };
  }

  listProjects(): ProjectRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM projects ORDER BY created_at DESC")
      .all() as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      path: r.path,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  getProject(id: string): ProjectRecord | null {
    const row = this.db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  getProjectByPath(path: string): ProjectRecord | null {
    const row = this.db
      .prepare("SELECT * FROM projects WHERE path = ?")
      .get(path) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  deleteProject(id: string): boolean {
    // Delete all related data first (order matters for foreign keys)
    this.db.prepare("DELETE FROM env_vars WHERE project_id = ?").run(id);
    this.db.prepare("DELETE FROM run_commands WHERE project_id = ?").run(id);
    this.db.prepare("DELETE FROM checkpoints WHERE project_id = ?").run(id);
    this.db.prepare("DELETE FROM activity_events WHERE project_id = ?").run(id);
    this.db.prepare("DELETE FROM messages WHERE project_id = ?").run(id);
    this.db.prepare("DELETE FROM rules WHERE project_id = ?").run(id);
    this.db.prepare("DELETE FROM sessions WHERE project_id = ?").run(id);
    this.db.prepare("DELETE FROM goals WHERE project_id = ?").run(id);
    this.db.prepare("DELETE FROM spec WHERE project_id = ?").run(id);
    this.db.prepare("DELETE FROM interview_notes WHERE project_id = ?").run(id);
    this.db.prepare("DELETE FROM project_state WHERE project_id = ?").run(id);
    const result = this.db
      .prepare("DELETE FROM projects WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  close(): void {
    this.db.close();
  }
}

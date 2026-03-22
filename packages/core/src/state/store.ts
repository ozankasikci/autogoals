import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { SCHEMA_SQL } from "./migrations.js";
import { SQLiteStore } from "./sqlite-store.js";
import { SQLiteProjectStore } from "./project-store.js";
import type { StateStore } from "./types.js";
import type { ProjectStore } from "./types.js";

function getDb(): Database.Database {
  const dir = join(homedir(), ".small-singularity");
  mkdirSync(dir, { recursive: true });
  const dbPath = join(dir, "db.sqlite");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);
  // Migrations for existing databases
  try { db.exec("ALTER TABLE goals ADD COLUMN planning_mode TEXT"); } catch {}
  return db;
}

export function createStore(projectId: string): StateStore {
  const db = getDb();
  return new SQLiteStore(db, projectId);
}

export function createProjectStore(): ProjectStore {
  const db = getDb();
  return new SQLiteProjectStore(db);
}

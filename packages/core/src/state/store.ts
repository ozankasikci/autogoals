import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join } from "path";
import { SCHEMA_SQL } from "./migrations.js";
import { SQLiteStore } from "./sqlite-store.js";
import type { StateStore } from "./types.js";

export function createStore(projectPath: string): StateStore {
  const dir = join(projectPath, ".small-singularity");
  mkdirSync(dir, { recursive: true });
  const dbPath = join(dir, "db.sqlite");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);
  return new SQLiteStore(db);
}

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { env } from "@/lib/env";
import { nowIso } from "@/lib/utils";
import type { TableRow, TableStateRow } from "@/lib/types/models";

let singleton: Database.Database | null = null;

function ensureDatabaseDir() {
  const absolute = path.resolve(process.cwd(), env.databasePath);
  const directory = path.dirname(absolute);
  fs.mkdirSync(directory, { recursive: true });
  return absolute;
}

function runSchema(db: Database.Database) {
  const schemaPath = path.resolve(process.cwd(), "db/schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  db.exec(schemaSql);
}

function seedDatabase(db: Database.Database) {
  const now = nowIso();
  const table = db
    .prepare<[], TableRow>("SELECT id, name, created_at, updated_at FROM tables ORDER BY id ASC LIMIT 1")
    .get();

  if (!table) {
    const insertTable = db.prepare("INSERT INTO tables (name, created_at, updated_at) VALUES (?, ?, ?)");
    const info = insertTable.run(env.tableName, now, now);

    db.prepare("INSERT INTO table_state (id, table_id, pot_amount, updated_at) VALUES (1, ?, 0, ?)").run(
      Number(info.lastInsertRowid),
      now
    );

    return;
  }

  const state = db.prepare<[], TableStateRow>("SELECT id, table_id, pot_amount, updated_at FROM table_state WHERE id = 1").get();
  if (!state) {
    db.prepare("INSERT INTO table_state (id, table_id, pot_amount, updated_at) VALUES (1, ?, 0, ?)").run(table.id, now);
  }
}

export function getDb() {
  if (singleton) {
    return singleton;
  }

  const dbPath = ensureDatabaseDir();
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  runSchema(db);
  seedDatabase(db);

  singleton = db;
  return singleton;
}

export function initDatabase() {
  const db = getDb();
  return {
    databasePath: db.name,
    ready: true
  };
}

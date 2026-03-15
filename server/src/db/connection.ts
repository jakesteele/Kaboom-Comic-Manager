import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.js';
import * as schema from './schema/index.js';
import * as relations from './relations.js';

let db: ReturnType<typeof createDb>;

function createDb() {
  mkdirSync(dirname(config.databasePath), { recursive: true });
  const sqlite = new Database(config.databasePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema: { ...schema, ...relations } });
}

export function getDb() {
  if (!db) {
    db = createDb();
  }
  return db;
}

export type Db = ReturnType<typeof getDb>;

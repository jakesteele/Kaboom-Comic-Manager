import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.js';
import * as schema from './schema/index.js';

/**
 * Push schema directly to SQLite (no migration files needed for dev).
 * For production, use drizzle-kit generate + migrate.
 */
export function ensureSchema() {
  mkdirSync(dirname(config.databasePath), { recursive: true });
  const sqlite = new Database(config.databasePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  // Create tables if they don't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS series (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_normalized TEXT NOT NULL,
      sort_title TEXT NOT NULL,
      thumbnail_path TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      series_id INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS volumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      volume_number REAL,
      year INTEGER,
      scan_group TEXT,
      file_size_bytes INTEGER NOT NULL,
      thumbnail_path TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      comic_info_parsed INTEGER NOT NULL DEFAULT 0,
      ci_title TEXT,
      ci_series TEXT,
      ci_number TEXT,
      ci_volume INTEGER,
      ci_year INTEGER,
      ci_writer TEXT,
      ci_summary TEXT,
      ci_page_count INTEGER,
      ci_language TEXT,
      ci_genre TEXT,
      page_count INTEGER,
      last_scanned_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS watch_directories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_scan_at INTEGER,
      file_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS scan_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      watch_dir_id INTEGER NOT NULL REFERENCES watch_directories(id) ON DELETE CASCADE,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      files_found INTEGER NOT NULL DEFAULT 0,
      files_added INTEGER NOT NULL DEFAULT 0,
      files_removed INTEGER NOT NULL DEFAULT 0,
      files_updated INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'running',
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS grouping_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_id INTEGER,
      source_name TEXT NOT NULL,
      target_series_id INTEGER REFERENCES series(id),
      target_series_name TEXT NOT NULL,
      similarity_score REAL NOT NULL,
      suggested_action TEXT NOT NULL,
      suggested_season_name TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      resolved_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS series_tags (
      series_id INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (series_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_volumes_file_path ON volumes(file_path);
    CREATE INDEX IF NOT EXISTS idx_volumes_season_id ON volumes(season_id);
    CREATE INDEX IF NOT EXISTS idx_seasons_series_id ON seasons(series_id);
    CREATE INDEX IF NOT EXISTS idx_grouping_status ON grouping_suggestions(status);
    CREATE INDEX IF NOT EXISTS idx_series_tags_tag_id ON series_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);

  sqlite.close();
}

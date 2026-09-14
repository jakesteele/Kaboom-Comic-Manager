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
      target_series_id INTEGER REFERENCES series(id) ON DELETE CASCADE,
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


    CREATE INDEX IF NOT EXISTS idx_volumes_file_path ON volumes(file_path);
    CREATE INDEX IF NOT EXISTS idx_volumes_season_id ON volumes(season_id);
    CREATE INDEX IF NOT EXISTS idx_seasons_series_id ON seasons(series_id);
    CREATE INDEX IF NOT EXISTS idx_grouping_status ON grouping_suggestions(status);
    CREATE INDEX IF NOT EXISTS idx_series_tags_tag_id ON series_tags(tag_id);
  `);

  // Auth was removed; clean up the table older installs created.
  sqlite.exec('DROP TABLE IF EXISTS users;');

  cascadeGroupingSuggestions(sqlite);

  sqlite.close();
}

/**
 * grouping_suggestions.target_series_id originally had no ON DELETE action, so SQLite refused to
 * delete any series a suggestion still pointed at - including resolved ones, which are never
 * removed. That blocked every series delete (moving volumes out of a series, merging, resetting
 * the library). SQLite can't ALTER a foreign key, so rebuild the table when the cascade is absent.
 */
export function cascadeGroupingSuggestions(sqlite: Database.Database) {
  const fks = sqlite.pragma('foreign_key_list(grouping_suggestions)') as Array<{
    table: string;
    from: string;
    on_delete: string;
  }>;
  const seriesFk = fks.find(fk => fk.table === 'series' && fk.from === 'target_series_id');
  if (!seriesFk || seriesFk.on_delete === 'CASCADE') return;

  // PRAGMA foreign_keys is a no-op inside a transaction, so it has to be toggled around it.
  sqlite.pragma('foreign_keys = OFF');
  try {
    sqlite.exec(`
      BEGIN;
      CREATE TABLE grouping_suggestions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type TEXT NOT NULL,
        source_id INTEGER,
        source_name TEXT NOT NULL,
        target_series_id INTEGER REFERENCES series(id) ON DELETE CASCADE,
        target_series_name TEXT NOT NULL,
        similarity_score REAL NOT NULL,
        suggested_action TEXT NOT NULL,
        suggested_season_name TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
        resolved_at INTEGER
      );

      -- Drop any row already orphaned, so the rebuilt table starts free of FK violations.
      INSERT INTO grouping_suggestions_new
        SELECT * FROM grouping_suggestions
        WHERE target_series_id IS NULL
           OR target_series_id IN (SELECT id FROM series);

      DROP TABLE grouping_suggestions;
      ALTER TABLE grouping_suggestions_new RENAME TO grouping_suggestions;
      CREATE INDEX IF NOT EXISTS idx_grouping_status ON grouping_suggestions(status);
      COMMIT;
    `);
  } catch (err) {
    sqlite.exec('ROLLBACK;');
    throw err;
  } finally {
    sqlite.pragma('foreign_keys = ON');
  }
}

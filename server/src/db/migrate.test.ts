import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { cascadeGroupingSuggestions } from './migrate.js';

/** The pre-fix shape: target_series_id with no ON DELETE action. */
const LEGACY_SQL = `
  CREATE TABLE series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_normalized TEXT NOT NULL,
    sort_title TEXT NOT NULL,
    thumbnail_path TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );
  CREATE TABLE grouping_suggestions (
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
  CREATE INDEX idx_grouping_status ON grouping_suggestions(status);

  INSERT INTO series (id, name, name_normalized, sort_title)
    VALUES (13, 'Hell Mode', 'hell mode', 'hamuo'), (14, 'Hell Mode', 'hell mode', 'hell mode -');
  INSERT INTO grouping_suggestions
    (source_type, source_name, target_series_id, target_series_name, similarity_score, suggested_action, status)
    VALUES
      ('series', 'Hell Mode', 14, 'Hell Mode', 0.9, 'merge_series', 'accepted'),
      ('series', 'Other', 13, 'Hell Mode', 0.8, 'merge_series', 'pending');
`;

function legacyDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(LEGACY_SQL);
  return sqlite;
}

function onDelete(sqlite: Database.Database) {
  const fks = sqlite.pragma('foreign_key_list(grouping_suggestions)') as Array<{ from: string; on_delete: string }>;
  return fks.find(fk => fk.from === 'target_series_id')?.on_delete;
}

describe('cascadeGroupingSuggestions', () => {
  it('rebuilds a legacy table so deleting a referenced series cascades', () => {
    const sqlite = legacyDb();
    expect(onDelete(sqlite)).toBe('NO ACTION');
    expect(() => sqlite.prepare('DELETE FROM series WHERE id = 14').run())
      .toThrow(/FOREIGN KEY/);

    cascadeGroupingSuggestions(sqlite);

    expect(onDelete(sqlite)).toBe('CASCADE');
    sqlite.prepare('DELETE FROM series WHERE id = 14').run();

    const left = sqlite.prepare('SELECT target_series_id FROM grouping_suggestions').all();
    expect(left).toEqual([{ target_series_id: 13 }]);
  });

  it('preserves existing rows, the index, and foreign_keys enforcement', () => {
    const sqlite = legacyDb();
    cascadeGroupingSuggestions(sqlite);

    const rows = sqlite.prepare('SELECT id, status, target_series_id FROM grouping_suggestions ORDER BY id').all();
    expect(rows).toEqual([
      { id: 1, status: 'accepted', target_series_id: 14 },
      { id: 2, status: 'pending', target_series_id: 13 },
    ]);

    const index = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_grouping_status'",
    ).get();
    expect(index).toBeDefined();
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('drops rows already orphaned rather than rebuilding a table that violates its own key', () => {
    const sqlite = legacyDb();
    sqlite.pragma('foreign_keys = OFF');
    sqlite.prepare(
      `INSERT INTO grouping_suggestions
       (source_type, source_name, target_series_id, target_series_name, similarity_score, suggested_action, status)
       VALUES ('series', 'Gone', 999, 'Gone', 0.7, 'merge_series', 'pending')`,
    ).run();
    sqlite.pragma('foreign_keys = ON');

    cascadeGroupingSuggestions(sqlite);

    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM grouping_suggestions').get()).toEqual({ n: 2 });
  });

  it('is a no-op once the cascade is already in place', () => {
    const sqlite = legacyDb();
    cascadeGroupingSuggestions(sqlite);
    const before = sqlite.prepare('SELECT * FROM grouping_suggestions ORDER BY id').all();

    cascadeGroupingSuggestions(sqlite);

    expect(onDelete(sqlite)).toBe('CASCADE');
    expect(sqlite.prepare('SELECT * FROM grouping_suggestions ORDER BY id').all()).toEqual(before);
  });
});

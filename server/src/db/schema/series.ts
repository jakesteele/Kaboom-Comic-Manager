import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const series = sqliteTable('series', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  nameNormalized: text('name_normalized').notNull(),
  sortTitle: text('sort_title').notNull(),
  thumbnailPath: text('thumbnail_path'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export const seasons = sqliteTable('seasons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  seriesId: integer('series_id').notNull().references(() => series.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export const volumes = sqliteTable('volumes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  seasonId: integer('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull().unique(),
  fileName: text('file_name').notNull(),
  displayName: text('display_name').notNull(),
  volumeNumber: real('volume_number'),
  year: integer('year'),
  scanGroup: text('scan_group'),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  thumbnailPath: text('thumbnail_path'),
  sortOrder: integer('sort_order').notNull().default(0),
  comicInfoParsed: integer('comic_info_parsed', { mode: 'boolean' }).notNull().default(false),
  ciTitle: text('ci_title'),
  ciSeries: text('ci_series'),
  ciNumber: text('ci_number'),
  ciVolume: integer('ci_volume'),
  ciYear: integer('ci_year'),
  ciWriter: text('ci_writer'),
  ciSummary: text('ci_summary'),
  ciPageCount: integer('ci_page_count'),
  ciLanguage: text('ci_language'),
  ciGenre: text('ci_genre'),
  pageCount: integer('page_count'),
  lastScannedAt: integer('last_scanned_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

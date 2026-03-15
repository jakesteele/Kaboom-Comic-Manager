import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const watchDirectories = sqliteTable('watch_directories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  path: text('path').notNull().unique(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  lastScanAt: integer('last_scan_at', { mode: 'timestamp_ms' }),
  fileCount: integer('file_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export const scanLog = sqliteTable('scan_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  watchDirId: integer('watch_dir_id').notNull().references(() => watchDirectories.id, { onDelete: 'cascade' }),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  filesFound: integer('files_found').notNull().default(0),
  filesAdded: integer('files_added').notNull().default(0),
  filesRemoved: integer('files_removed').notNull().default(0),
  filesUpdated: integer('files_updated').notNull().default(0),
  status: text('status').notNull().default('running'),
  errorMessage: text('error_message'),
});

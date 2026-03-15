import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { series } from './series.js';

export const groupingSuggestions = sqliteTable('grouping_suggestions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceType: text('source_type').notNull(),
  sourceId: integer('source_id'),
  sourceName: text('source_name').notNull(),
  targetSeriesId: integer('target_series_id').references(() => series.id),
  targetSeriesName: text('target_series_name').notNull(),
  similarityScore: real('similarity_score').notNull(),
  suggestedAction: text('suggested_action').notNull(),
  suggestedSeasonName: text('suggested_season_name'),
  status: text('status').notNull().default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),
});

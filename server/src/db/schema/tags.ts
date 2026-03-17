import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { series } from './series.js';

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export const seriesTags = sqliteTable('series_tags', {
  seriesId: integer('series_id').notNull().references(() => series.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.seriesId, table.tagId] }),
]);

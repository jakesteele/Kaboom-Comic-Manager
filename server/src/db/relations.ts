import { relations } from 'drizzle-orm';
import { series, seasons, volumes } from './schema/series.js';
import { watchDirectories, scanLog } from './schema/library.js';
import { groupingSuggestions } from './schema/grouping.js';

export const seriesRelations = relations(series, ({ many }) => ({
  seasons: many(seasons),
}));

export const seasonsRelations = relations(seasons, ({ one, many }) => ({
  series: one(series, { fields: [seasons.seriesId], references: [series.id] }),
  volumes: many(volumes),
}));

export const volumesRelations = relations(volumes, ({ one }) => ({
  season: one(seasons, { fields: [volumes.seasonId], references: [seasons.id] }),
}));

export const watchDirectoriesRelations = relations(watchDirectories, ({ many }) => ({
  scanLogs: many(scanLog),
}));

export const scanLogRelations = relations(scanLog, ({ one }) => ({
  watchDirectory: one(watchDirectories, { fields: [scanLog.watchDirId], references: [watchDirectories.id] }),
}));

export const groupingSuggestionsRelations = relations(groupingSuggestions, ({ one }) => ({
  targetSeries: one(series, { fields: [groupingSuggestions.targetSeriesId], references: [series.id] }),
}));

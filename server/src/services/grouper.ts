import { eq, and } from 'drizzle-orm';
import type { Db } from '../db/connection.js';
import { series, seasons } from '../db/schema/index.js';
import { groupingSuggestions } from '../db/schema/grouping.js';
import { compareSeries } from '../utils/normalize.js';

/**
 * Check all series pairs for potential grouping suggestions.
 * Called after each scan completes.
 */
export function checkGroupingSuggestions(db: Db): void {
  const allSeries = db.select().from(series).all();
  if (allSeries.length < 2) return;

  for (let i = 0; i < allSeries.length; i++) {
    for (let j = i + 1; j < allSeries.length; j++) {
      const a = allSeries[i];
      const b = allSeries[j];

      // Skip if already have a suggestion for this pair (in either direction)
      const existingSuggestion = db.select().from(groupingSuggestions)
        .where(
          and(
            eq(groupingSuggestions.sourceName, a.name),
            eq(groupingSuggestions.targetSeriesName, b.name),
          )
        ).get();
      if (existingSuggestion) continue;

      const existingReverse = db.select().from(groupingSuggestions)
        .where(
          and(
            eq(groupingSuggestions.sourceName, b.name),
            eq(groupingSuggestions.targetSeriesName, a.name),
          )
        ).get();
      if (existingReverse) continue;

      const comparison = compareSeries(a.name, b.name);

      if (comparison.relationship === 'unrelated' || comparison.relationship === 'exact') continue;

      if (comparison.relationship === 'parent-child') {
        const parent = a.nameNormalized.length <= b.nameNormalized.length ? a : b;
        const child = a.nameNormalized.length <= b.nameNormalized.length ? b : a;

        db.insert(groupingSuggestions).values({
          sourceType: 'series',
          sourceId: child.id,
          sourceName: child.name,
          targetSeriesId: parent.id,
          targetSeriesName: parent.name,
          similarityScore: comparison.score,
          suggestedAction: 'add_as_season',
          suggestedSeasonName: comparison.remainder || child.name,
          status: 'pending',
        }).run();
      } else if (comparison.relationship === 'similar') {
        const target = a.id < b.id ? a : b;
        const source = a.id < b.id ? b : a;

        db.insert(groupingSuggestions).values({
          sourceType: 'series',
          sourceId: source.id,
          sourceName: source.name,
          targetSeriesId: target.id,
          targetSeriesName: target.name,
          similarityScore: comparison.score,
          suggestedAction: 'merge_series',
          status: 'pending',
        }).run();
      }
    }
  }
}

/**
 * Accept a grouping suggestion: execute the suggested action.
 */
export function acceptGroupingSuggestion(db: Db, suggestionId: number): void {
  const suggestion = db.select().from(groupingSuggestions)
    .where(eq(groupingSuggestions.id, suggestionId)).get();

  if (!suggestion || suggestion.status !== 'pending') return;

  if (suggestion.suggestedAction === 'add_as_season' && suggestion.sourceId && suggestion.targetSeriesId) {
    const sourceSeasons = db.select().from(seasons)
      .where(eq(seasons.seriesId, suggestion.sourceId)).all();

    for (const season of sourceSeasons) {
      db.update(seasons).set({
        seriesId: suggestion.targetSeriesId,
        name: suggestion.suggestedSeasonName || season.name,
        updatedAt: new Date(),
      }).where(eq(seasons.id, season.id)).run();
    }

    db.delete(series).where(eq(series.id, suggestion.sourceId)).run();

  } else if (suggestion.suggestedAction === 'merge_series' && suggestion.sourceId && suggestion.targetSeriesId) {
    db.update(seasons).set({
      seriesId: suggestion.targetSeriesId,
      updatedAt: new Date(),
    }).where(eq(seasons.seriesId, suggestion.sourceId)).run();

    db.delete(series).where(eq(series.id, suggestion.sourceId)).run();
  }

  db.update(groupingSuggestions).set({
    status: 'accepted',
    resolvedAt: new Date(),
  }).where(eq(groupingSuggestions.id, suggestionId)).run();
}

/**
 * Reject a grouping suggestion.
 */
export function rejectGroupingSuggestion(db: Db, suggestionId: number): void {
  db.update(groupingSuggestions).set({
    status: 'rejected',
    resolvedAt: new Date(),
  }).where(eq(groupingSuggestions.id, suggestionId)).run();
}

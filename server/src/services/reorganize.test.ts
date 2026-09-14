import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, type TestDb } from '../db/test-helpers.js';
import { series, seasons, volumes, groupingSuggestions } from '../db/schema/index.js';
import { moveVolumesToSeries } from './reorganize.js';

let db: TestDb;

beforeEach(() => {
  db = createTestDb();
});

function createSeries(name: string) {
  return db.insert(series).values({
    name, nameNormalized: name.toLowerCase(), sortTitle: name.toLowerCase(),
  }).returning().get();
}

function createSeason(seriesId: number, name: string, sortOrder = 0) {
  return db.insert(seasons).values({ seriesId, name, sortOrder }).returning().get();
}

let fileCounter = 0;
function createVolume(seasonId: number, sortOrder: number) {
  fileCounter++;
  return db.insert(volumes).values({
    seasonId,
    filePath: `/comics/vol${fileCounter}.cbz`,
    fileName: `vol${fileCounter}.cbz`,
    displayName: `Vol ${fileCounter}`,
    fileSizeBytes: 1000,
    sortOrder,
  }).returning().get();
}

function volumesIn(seasonId: number) {
  return db.select().from(volumes).where(eq(volumes.seasonId, seasonId)).orderBy(volumes.sortOrder).all();
}

describe('moveVolumesToSeries', () => {
  it('moves volumes into the target series first season, appended at the end', () => {
    const src = createSeries('Source');
    const srcSeason = createSeason(src.id, 'Main');
    const v1 = createVolume(srcSeason.id, 0);
    const v2 = createVolume(srcSeason.id, 1);
    const v3 = createVolume(srcSeason.id, 2);

    const dst = createSeries('Target');
    const dstSeason = createSeason(dst.id, 'Main');
    const existing = createVolume(dstSeason.id, 0);

    const result = moveVolumesToSeries(db, { volumeIds: [v1.id, v3.id], targetSeriesId: dst.id });

    expect(result.targetSeasonId).toBe(dstSeason.id);
    expect(result.moved).toBe(2);
    expect(result.sourceSeriesDeleted).toEqual([]);

    const moved = volumesIn(dstSeason.id);
    expect(moved.map(v => v.id)).toEqual([existing.id, v1.id, v3.id]);
    expect(moved.map(v => v.sortOrder)).toEqual([0, 1, 2]);

    expect(volumesIn(srcSeason.id).map(v => v.id)).toEqual([v2.id]);
  });

  it('uses the lowest sort-order season when the target has several', () => {
    const src = createSeries('Source');
    const srcSeason = createSeason(src.id, 'Main');
    const v1 = createVolume(srcSeason.id, 0);
    createVolume(srcSeason.id, 1);

    const dst = createSeries('Target');
    createSeason(dst.id, 'Later', 5);
    const first = createSeason(dst.id, 'First', 1);

    const result = moveVolumesToSeries(db, { volumeIds: [v1.id], targetSeriesId: dst.id });
    expect(result.targetSeasonId).toBe(first.id);
  });

  it('honours an explicit target season', () => {
    const src = createSeries('Source');
    const srcSeason = createSeason(src.id, 'Main');
    const v1 = createVolume(srcSeason.id, 0);
    createVolume(srcSeason.id, 1);

    const dst = createSeries('Target');
    createSeason(dst.id, 'Main', 0);
    const zero = createSeason(dst.id, 'Zero', 1);

    const result = moveVolumesToSeries(db, { volumeIds: [v1.id], targetSeriesId: dst.id, targetSeasonId: zero.id });
    expect(result.targetSeasonId).toBe(zero.id);
    expect(volumesIn(zero.id).map(v => v.id)).toEqual([v1.id]);
  });

  it('creates a Main season when the target series has none', () => {
    const src = createSeries('Source');
    const srcSeason = createSeason(src.id, 'Main');
    const v1 = createVolume(srcSeason.id, 0);
    createVolume(srcSeason.id, 1);

    const dst = createSeries('Empty Target');

    const result = moveVolumesToSeries(db, { volumeIds: [v1.id], targetSeriesId: dst.id });
    const created = db.select().from(seasons).where(eq(seasons.seriesId, dst.id)).all();
    expect(created).toHaveLength(1);
    expect(created[0].name).toBe('Main');
    expect(result.targetSeasonId).toBe(created[0].id);
  });

  it('deletes emptied source seasons and emptied source series', () => {
    const src = createSeries('Source');
    const srcSeason = createSeason(src.id, 'Main');
    const v1 = createVolume(srcSeason.id, 0);
    const v2 = createVolume(srcSeason.id, 1);

    const dst = createSeries('Target');
    createSeason(dst.id, 'Main');

    const result = moveVolumesToSeries(db, { volumeIds: [v1.id, v2.id], targetSeriesId: dst.id });

    expect(result.sourceSeriesDeleted).toEqual([src.id]);
    expect(db.select().from(seasons).where(eq(seasons.id, srcSeason.id)).get()).toBeUndefined();
    expect(db.select().from(series).where(eq(series.id, src.id)).get()).toBeUndefined();
  });

  it('keeps a source series alive when other seasons remain', () => {
    const src = createSeries('Source');
    const s1 = createSeason(src.id, 'Main', 0);
    const s2 = createSeason(src.id, 'Zero', 1);
    const v1 = createVolume(s1.id, 0);
    createVolume(s2.id, 0);

    const dst = createSeries('Target');
    createSeason(dst.id, 'Main');

    const result = moveVolumesToSeries(db, { volumeIds: [v1.id], targetSeriesId: dst.id });

    expect(result.sourceSeriesDeleted).toEqual([]);
    expect(db.select().from(seasons).where(eq(seasons.id, s1.id)).get()).toBeUndefined();
    expect(db.select().from(series).where(eq(series.id, src.id)).get()).toBeDefined();
  });

  it('rejects an explicit season that belongs to a different series', () => {
    const src = createSeries('Source');
    const srcSeason = createSeason(src.id, 'Main');
    const v1 = createVolume(srcSeason.id, 0);
    const dst = createSeries('Target');
    createSeason(dst.id, 'Main');

    expect(() =>
      moveVolumesToSeries(db, { volumeIds: [v1.id], targetSeriesId: dst.id, targetSeasonId: srcSeason.id }),
    ).toThrow(/season/i);
  });

  it('rejects unknown volumes and unknown target series', () => {
    const dst = createSeries('Target');
    expect(() => moveVolumesToSeries(db, { volumeIds: [999], targetSeriesId: dst.id })).toThrow(/volume/i);

    const src = createSeries('Source');
    const srcSeason = createSeason(src.id, 'Main');
    const v1 = createVolume(srcSeason.id, 0);
    expect(() => moveVolumesToSeries(db, { volumeIds: [v1.id], targetSeriesId: 999 })).toThrow(/series/i);
  });

  it('is a no-op for volumes already in the target season', () => {
    const dst = createSeries('Target');
    const dstSeason = createSeason(dst.id, 'Main');
    const v1 = createVolume(dstSeason.id, 0);
    const v2 = createVolume(dstSeason.id, 1);

    const result = moveVolumesToSeries(db, { volumeIds: [v1.id], targetSeriesId: dst.id });
    expect(result.moved).toBe(0);
    expect(volumesIn(dstSeason.id).map(v => v.id)).toEqual([v1.id, v2.id]);
    expect(db.select().from(seasons).where(eq(seasons.id, dstSeason.id)).get()).toBeDefined();
  });
  it('deletes an emptied source series that a resolved grouping suggestion still points at', () => {
    const src = createSeries('Source');
    const srcSeason = createSeason(src.id, 'Main');
    const v1 = createVolume(srcSeason.id, 0);
    const dst = createSeries('Target');
    const dstSeason = createSeason(dst.id, 'Main');

    // A suggestion that was already accepted/rejected keeps referencing the series it targeted.
    db.insert(groupingSuggestions).values({
      sourceType: 'series',
      sourceId: dst.id,
      sourceName: dst.name,
      targetSeriesId: src.id,
      targetSeriesName: src.name,
      similarityScore: 0.9,
      suggestedAction: 'merge_series',
      status: 'accepted',
    }).run();

    const result = moveVolumesToSeries(db, { volumeIds: [v1.id], targetSeriesId: dst.id });

    expect(result.sourceSeriesDeleted).toEqual([src.id]);
    expect(db.select().from(series).where(eq(series.id, src.id)).get()).toBeUndefined();
    expect(volumesIn(dstSeason.id).map(v => v.id)).toEqual([v1.id]);
    expect(db.select().from(groupingSuggestions).all()).toEqual([]);
  });
});

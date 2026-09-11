import { asc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/connection.js';
import { series, seasons, volumes } from '../db/schema/index.js';

export class ReorganizeError extends Error {
  constructor(message: string, public readonly status: 400 | 404) {
    super(message);
  }
}

export interface MoveVolumesInput {
  volumeIds: number[];
  targetSeriesId: number;
  /** Season inside the target series. Defaults to its first season (created as "Main" if none). */
  targetSeasonId?: number;
}

export interface MoveVolumesResult {
  moved: number;
  targetSeasonId: number;
  /** Source series that ended up with no seasons and were removed. */
  sourceSeriesDeleted: number[];
}

/**
 * Move volumes into another series, appending them after that series' existing volumes.
 * Emptied source seasons are removed, and a source series left with no seasons is removed too,
 * matching how season moves already behave.
 */
export function moveVolumesToSeries(db: Db, input: MoveVolumesInput): MoveVolumesResult {
  const volumeIds = [...new Set(input.volumeIds)];
  if (volumeIds.length === 0) {
    throw new ReorganizeError('volumeIds must contain at least one id', 400);
  }

  return db.transaction((tx) => {
    const target = tx.select().from(series).where(eq(series.id, input.targetSeriesId)).get();
    if (!target) throw new ReorganizeError('Target series not found', 404);

    const found = tx.select().from(volumes).where(inArray(volumes.id, volumeIds)).all();
    if (found.length !== volumeIds.length) throw new ReorganizeError('One or more volumes not found', 404);

    const targetSeasonId = resolveTargetSeason(tx, input.targetSeriesId, input.targetSeasonId);

    const toMove = found.filter(v => v.seasonId !== targetSeasonId);
    const sourceSeasonIds = [...new Set(toMove.map(v => v.seasonId))];

    const last = tx.select({ sortOrder: volumes.sortOrder }).from(volumes)
      .where(eq(volumes.seasonId, targetSeasonId))
      .orderBy(asc(volumes.sortOrder)).all().pop();
    let nextSort = (last?.sortOrder ?? -1) + 1;

    // Preserve the caller's ordering so a multi-select lands in a predictable order.
    const byId = new Map(toMove.map(v => [v.id, v]));
    for (const id of volumeIds) {
      if (!byId.has(id)) continue;
      tx.update(volumes)
        .set({ seasonId: targetSeasonId, sortOrder: nextSort++, updatedAt: new Date() })
        .where(eq(volumes.id, id)).run();
    }

    const sourceSeriesDeleted = cleanupEmptied(tx, sourceSeasonIds);

    return { moved: toMove.length, targetSeasonId, sourceSeriesDeleted };
  });
}

function resolveTargetSeason(tx: Db, targetSeriesId: number, explicitSeasonId?: number): number {
  if (explicitSeasonId !== undefined) {
    const season = tx.select().from(seasons).where(eq(seasons.id, explicitSeasonId)).get();
    if (!season || season.seriesId !== targetSeriesId) {
      throw new ReorganizeError('Target season not found in target series', 404);
    }
    return season.id;
  }

  const first = tx.select().from(seasons).where(eq(seasons.seriesId, targetSeriesId))
    .orderBy(asc(seasons.sortOrder)).limit(1).get();
  if (first) return first.id;

  return tx.insert(seasons).values({ seriesId: targetSeriesId, name: 'Main', sortOrder: 0 })
    .returning().get().id;
}

function cleanupEmptied(tx: Db, sourceSeasonIds: number[]): number[] {
  const deletedSeries: number[] = [];
  for (const seasonId of sourceSeasonIds) {
    const stillHasVolumes = tx.select({ id: volumes.id }).from(volumes)
      .where(eq(volumes.seasonId, seasonId)).limit(1).get();
    if (stillHasVolumes) continue;

    const season = tx.select().from(seasons).where(eq(seasons.id, seasonId)).get();
    if (!season) continue;
    tx.delete(seasons).where(eq(seasons.id, seasonId)).run();

    const remaining = tx.select({ id: seasons.id }).from(seasons)
      .where(eq(seasons.seriesId, season.seriesId)).limit(1).get();
    if (!remaining) {
      tx.delete(series).where(eq(series.id, season.seriesId)).run();
      deletedSeries.push(season.seriesId);
    }
  }
  return deletedSeries;
}

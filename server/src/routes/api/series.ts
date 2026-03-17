import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { series, seasons, volumes, tags, seriesTags } from '../../db/schema/index.js';
import { normalizeName } from '../../utils/normalize.js';

export async function seriesRoutes(app: FastifyInstance) {
  // GET / - list all series with season count and volume count
  app.get('/', async () => {
    const db = getDb();

    const rows = db.select().from(series).orderBy(series.sortTitle).all();

    // Compute counts per series in a single query
    const counts = db
      .select({
        seriesId: seasons.seriesId,
        seasonCount: sql<number>`count(distinct ${seasons.id})`,
        volumeCount: sql<number>`count(${volumes.id})`,
      })
      .from(seasons)
      .leftJoin(volumes, eq(volumes.seasonId, seasons.id))
      .groupBy(seasons.seriesId)
      .all();

    const countMap = new Map(counts.map(c => [c.seriesId, c]));

    // Fetch all series-tag associations in one query to avoid N+1
    const tagRows = db
      .select({
        seriesId: seriesTags.seriesId,
        tagId: tags.id,
        tagName: tags.name,
      })
      .from(seriesTags)
      .innerJoin(tags, eq(seriesTags.tagId, tags.id))
      .all();

    const tagMap = new Map<number, { id: number; name: string }[]>();
    for (const row of tagRows) {
      if (!tagMap.has(row.seriesId)) tagMap.set(row.seriesId, []);
      tagMap.get(row.seriesId)!.push({ id: row.tagId, name: row.tagName });
    }

    return rows.map(row => ({
      ...row,
      seasonCount: countMap.get(row.id)?.seasonCount ?? 0,
      volumeCount: countMap.get(row.id)?.volumeCount ?? 0,
      tags: tagMap.get(row.id) ?? [],
    }));
  });

  // GET /:id - get series with all seasons and their volumes
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const db = getDb();
    const id = Number(req.params.id);

    const result = db.query.series.findFirst({
      where: eq(series.id, id),
      with: {
        seasons: {
          orderBy: (s, { asc }) => [asc(s.sortOrder)],
          with: {
            volumes: {
              orderBy: (v, { asc }) => [asc(v.sortOrder)],
            },
          },
        },
      },
    });

    if (!result) {
      return reply.status(404).send({ error: 'Series not found' });
    }

    return result;
  });

  // PATCH /:id - update series name, sortTitle
  app.patch<{ Params: { id: string }; Body: { name?: string; sortTitle?: string } }>(
    '/:id',
    async (req, reply) => {
      const db = getDb();
      const id = Number(req.params.id);

      const existing = db.select().from(series).where(eq(series.id, id)).get();
      if (!existing) {
        return reply.status(404).send({ error: 'Series not found' });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (req.body.name !== undefined) {
        updates.name = req.body.name;
        updates.nameNormalized = normalizeName(req.body.name);
      }
      if (req.body.sortTitle !== undefined) {
        updates.sortTitle = req.body.sortTitle;
      }

      db.update(series).set(updates).where(eq(series.id, id)).run();

      const updated = db.select().from(series).where(eq(series.id, id)).get();
      return updated;
    },
  );

  // POST /:id/merge - merge another series into this one
  app.post<{ Params: { id: string }; Body: { sourceSeriesId: number } }>(
    '/:id/merge',
    async (req, reply) => {
      const db = getDb();
      const targetId = Number(req.params.id);
      const { sourceSeriesId } = req.body;

      if (!sourceSeriesId) {
        return reply.status(400).send({ error: 'sourceSeriesId is required' });
      }
      if (sourceSeriesId === targetId) {
        return reply.status(400).send({ error: 'Cannot merge a series into itself' });
      }

      const target = db.select().from(series).where(eq(series.id, targetId)).get();
      if (!target) {
        return reply.status(404).send({ error: 'Target series not found' });
      }

      const source = db.select().from(series).where(eq(series.id, sourceSeriesId)).get();
      if (!source) {
        return reply.status(404).send({ error: 'Source series not found' });
      }

      // Move all seasons from source to target
      db.update(seasons)
        .set({ seriesId: targetId, updatedAt: new Date() })
        .where(eq(seasons.seriesId, sourceSeriesId))
        .run();

      // Delete the source series
      db.delete(series).where(eq(series.id, sourceSeriesId)).run();

      // Return updated target with all seasons
      const result = db.query.series.findFirst({
        where: eq(series.id, targetId),
        with: {
          seasons: {
            orderBy: (s, { asc }) => [asc(s.sortOrder)],
            with: {
              volumes: {
                orderBy: (v, { asc }) => [asc(v.sortOrder)],
              },
            },
          },
        },
      });

      return result;
    },
  );

  // POST /:id/remove-season - promote a season to its own series
  app.post<{ Params: { id: string }; Body: { seasonId: number } }>(
    '/:id/remove-season',
    async (req, reply) => {
      const db = getDb();
      const sourceSeriesId = Number(req.params.id);
      const { seasonId } = req.body;

      if (!seasonId) {
        return reply.status(400).send({ error: 'seasonId is required' });
      }

      const season = db.select().from(seasons).where(eq(seasons.id, seasonId)).get();
      if (!season || season.seriesId !== sourceSeriesId) {
        return reply.status(404).send({ error: 'Season not found in this series' });
      }

      const sourceSeries = db.select().from(series).where(eq(series.id, sourceSeriesId)).get();
      if (!sourceSeries) {
        return reply.status(404).send({ error: 'Series not found' });
      }

      // Create a new series with the season's name (or combined name if "Main")
      const newName = season.name === 'Main' ? sourceSeries.name + ' - ' + season.name : season.name;
      const newSeries = db
        .insert(series)
        .values({
          name: newName,
          nameNormalized: normalizeName(newName),
          sortTitle: newName.toLowerCase(),
        })
        .returning()
        .get();

      // Move the season to the new series and rename to "Main"
      db.update(seasons)
        .set({ seriesId: newSeries.id, name: 'Main', sortOrder: 0, updatedAt: new Date() })
        .where(eq(seasons.id, seasonId))
        .run();

      // Clean up: if the source series has no more seasons, delete it
      const remaining = db.select().from(seasons).where(eq(seasons.seriesId, sourceSeriesId)).get();
      if (!remaining) {
        db.delete(series).where(eq(series.id, sourceSeriesId)).run();
      }

      return { newSeriesId: newSeries.id, name: newSeries.name };
    },
  );

  // POST /:id/move-season - move a season to a different existing series
  app.post<{ Params: { id: string }; Body: { seasonId: number; targetSeriesId: number } }>(
    '/:id/move-season',
    async (req, reply) => {
      const db = getDb();
      const sourceSeriesId = Number(req.params.id);
      const { seasonId, targetSeriesId } = req.body;

      if (!seasonId || !targetSeriesId) {
        return reply.status(400).send({ error: 'seasonId and targetSeriesId are required' });
      }
      if (targetSeriesId === sourceSeriesId) {
        return reply.status(400).send({ error: 'Target series must be different from source' });
      }

      const season = db.select().from(seasons).where(eq(seasons.id, seasonId)).get();
      if (!season || season.seriesId !== sourceSeriesId) {
        return reply.status(404).send({ error: 'Season not found in this series' });
      }

      const target = db.select().from(series).where(eq(series.id, targetSeriesId)).get();
      if (!target) {
        return reply.status(404).send({ error: 'Target series not found' });
      }

      // Get next sort order in target series
      const lastSeason = db
        .select({ max: seasons.sortOrder })
        .from(seasons)
        .where(eq(seasons.seriesId, targetSeriesId))
        .get();
      const sortOrder = (lastSeason?.max ?? -1) + 1;

      // Move the season
      db.update(seasons)
        .set({ seriesId: targetSeriesId, sortOrder, updatedAt: new Date() })
        .where(eq(seasons.id, seasonId))
        .run();

      // Clean up: if the source series has no more seasons, delete it
      const remaining = db.select().from(seasons).where(eq(seasons.seriesId, sourceSeriesId)).get();
      if (!remaining) {
        db.delete(series).where(eq(series.id, sourceSeriesId)).run();
      }

      return { moved: true, targetSeriesId };
    },
  );

  // DELETE /:id - delete series and cascade
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const db = getDb();
    const id = Number(req.params.id);

    const existing = db.select().from(series).where(eq(series.id, id)).get();
    if (!existing) {
      return reply.status(404).send({ error: 'Series not found' });
    }

    db.delete(series).where(eq(series.id, id)).run();
    return reply.status(204).send();
  });
}

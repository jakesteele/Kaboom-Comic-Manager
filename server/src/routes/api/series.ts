import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { series, seasons, volumes } from '../../db/schema/index.js';
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

    return rows.map(row => ({
      ...row,
      seasonCount: countMap.get(row.id)?.seasonCount ?? 0,
      volumeCount: countMap.get(row.id)?.volumeCount ?? 0,
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

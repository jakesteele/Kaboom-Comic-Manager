import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { series, seasons } from '../../db/schema/index.js';

export async function seasonsRoutes(app: FastifyInstance) {
  // POST / - create a season
  app.post<{ Body: { seriesId: number; name: string } }>('/', async (req, reply) => {
    const db = getDb();
    const { seriesId, name } = req.body;

    if (!seriesId || !name) {
      return reply.status(400).send({ error: 'seriesId and name are required' });
    }

    const parentSeries = db.select().from(series).where(eq(series.id, seriesId)).get();
    if (!parentSeries) {
      return reply.status(404).send({ error: 'Series not found' });
    }

    // Get next sort order
    const existing = db
      .select({ max: seasons.sortOrder })
      .from(seasons)
      .where(eq(seasons.seriesId, seriesId))
      .get();
    const sortOrder = (existing?.max ?? -1) + 1;

    const result = db
      .insert(seasons)
      .values({ seriesId, name, sortOrder })
      .returning()
      .get();

    return reply.status(201).send(result);
  });

  // PATCH /:id - update season name, sortOrder
  app.patch<{ Params: { id: string }; Body: { name?: string; sortOrder?: number } }>(
    '/:id',
    async (req, reply) => {
      const db = getDb();
      const id = Number(req.params.id);

      const existing = db.select().from(seasons).where(eq(seasons.id, id)).get();
      if (!existing) {
        return reply.status(404).send({ error: 'Season not found' });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (req.body.name !== undefined) {
        updates.name = req.body.name;
      }
      if (req.body.sortOrder !== undefined) {
        updates.sortOrder = req.body.sortOrder;
      }

      db.update(seasons).set(updates).where(eq(seasons.id, id)).run();

      const updated = db.select().from(seasons).where(eq(seasons.id, id)).get();
      return updated;
    },
  );

  // DELETE /:id - delete season (cascade deletes volumes)
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const db = getDb();
    const id = Number(req.params.id);

    const existing = db.select().from(seasons).where(eq(seasons.id, id)).get();
    if (!existing) {
      return reply.status(404).send({ error: 'Season not found' });
    }

    db.delete(seasons).where(eq(seasons.id, id)).run();
    return reply.status(204).send();
  });

  // POST /:id/reorder - update sort order
  app.post<{ Params: { id: string }; Body: { sortOrder: number } }>(
    '/:id/reorder',
    async (req, reply) => {
      const db = getDb();
      const id = Number(req.params.id);
      const { sortOrder } = req.body;

      if (sortOrder === undefined || sortOrder === null) {
        return reply.status(400).send({ error: 'sortOrder is required' });
      }

      const existing = db.select().from(seasons).where(eq(seasons.id, id)).get();
      if (!existing) {
        return reply.status(404).send({ error: 'Season not found' });
      }

      db.update(seasons)
        .set({ sortOrder, updatedAt: new Date() })
        .where(eq(seasons.id, id))
        .run();

      const updated = db.select().from(seasons).where(eq(seasons.id, id)).get();
      return updated;
    },
  );
}

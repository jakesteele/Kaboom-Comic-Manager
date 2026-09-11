import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { seasons, volumes } from '../../db/schema/index.js';
import { moveVolumesToSeries, ReorganizeError } from '../../services/reorganize.js';

export async function volumesRoutes(app: FastifyInstance) {
  // PATCH /:id - update volume displayName
  app.patch<{ Params: { id: string }; Body: { displayName?: string } }>(
    '/:id',
    async (req, reply) => {
      const db = getDb();
      const id = Number(req.params.id);

      const existing = db.select().from(volumes).where(eq(volumes.id, id)).get();
      if (!existing) {
        return reply.status(404).send({ error: 'Volume not found' });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (req.body.displayName !== undefined) {
        updates.displayName = req.body.displayName;
      }

      db.update(volumes).set(updates).where(eq(volumes.id, id)).run();

      const updated = db.select().from(volumes).where(eq(volumes.id, id)).get();
      return updated;
    },
  );

  // POST /:id/move - move volume to different season
  app.post<{ Params: { id: string }; Body: { targetSeasonId: number; sortOrder?: number } }>(
    '/:id/move',
    async (req, reply) => {
      const db = getDb();
      const id = Number(req.params.id);
      const { targetSeasonId, sortOrder } = req.body;

      if (!targetSeasonId) {
        return reply.status(400).send({ error: 'targetSeasonId is required' });
      }

      const volume = db.select().from(volumes).where(eq(volumes.id, id)).get();
      if (!volume) {
        return reply.status(404).send({ error: 'Volume not found' });
      }

      const targetSeason = db.select().from(seasons).where(eq(seasons.id, targetSeasonId)).get();
      if (!targetSeason) {
        return reply.status(404).send({ error: 'Target season not found' });
      }

      const updates: Record<string, unknown> = {
        seasonId: targetSeasonId,
        updatedAt: new Date(),
      };

      if (sortOrder !== undefined) {
        updates.sortOrder = sortOrder;
      }

      db.update(volumes).set(updates).where(eq(volumes.id, id)).run();

      const updated = db.select().from(volumes).where(eq(volumes.id, id)).get();
      return updated;
    },
  );

  // POST /move-to-series - move one or more volumes into another series
  app.post<{ Body: { volumeIds: number[]; targetSeriesId: number; targetSeasonId?: number } }>(
    '/move-to-series',
    async (req, reply) => {
      const { volumeIds, targetSeriesId, targetSeasonId } = req.body ?? {};

      if (!Array.isArray(volumeIds) || volumeIds.length === 0 || !volumeIds.every(id => Number.isInteger(id))) {
        return reply.status(400).send({ error: 'volumeIds must be a non-empty array of ids' });
      }
      if (!Number.isInteger(targetSeriesId)) {
        return reply.status(400).send({ error: 'targetSeriesId is required' });
      }
      if (targetSeasonId !== undefined && !Number.isInteger(targetSeasonId)) {
        return reply.status(400).send({ error: 'targetSeasonId must be an id' });
      }

      try {
        return moveVolumesToSeries(getDb(), { volumeIds, targetSeriesId, targetSeasonId });
      } catch (err) {
        if (err instanceof ReorganizeError) {
          return reply.status(err.status).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  // PATCH /reorder - batch reorder volumes
  app.patch<{ Body: { updates: Array<{ id: number; sortOrder: number }> } }>(
    '/reorder',
    async (req, reply) => {
      const db = getDb();
      const { updates } = req.body;

      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return reply.status(400).send({ error: 'updates array is required' });
      }

      for (const { id, sortOrder } of updates) {
        db.update(volumes)
          .set({ sortOrder, updatedAt: new Date() })
          .where(eq(volumes.id, id))
          .run();
      }

      return { updated: updates.length };
    },
  );
}

import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { tags, seriesTags } from '../../db/schema/index.js';

export async function tagsRoutes(app: FastifyInstance) {
  // GET / - list all tags with series count
  app.get('/', async () => {
    const db = getDb();
    const rows = db
      .select({
        id: tags.id,
        name: tags.name,
        createdAt: tags.createdAt,
        seriesCount: sql<number>`count(${seriesTags.seriesId})`,
      })
      .from(tags)
      .leftJoin(seriesTags, eq(seriesTags.tagId, tags.id))
      .groupBy(tags.id)
      .orderBy(tags.name)
      .all();
    return rows;
  });

  // POST / - create a tag
  app.post<{ Body: { name: string } }>('/', async (req, reply) => {
    const db = getDb();
    const { name } = req.body;
    if (!name?.trim()) {
      return reply.status(400).send({ error: 'name is required' });
    }

    const existing = db.select().from(tags).where(eq(tags.name, name.trim())).get();
    if (existing) {
      return reply.status(409).send({ error: 'Tag already exists' });
    }

    const result = db.insert(tags).values({ name: name.trim() }).returning().get();
    return reply.status(201).send(result);
  });

  // PATCH /:id - rename a tag
  app.patch<{ Params: { id: string }; Body: { name: string } }>(
    '/:id',
    async (req, reply) => {
      const db = getDb();
      const id = Number(req.params.id);
      const { name } = req.body;

      if (!name?.trim()) {
        return reply.status(400).send({ error: 'name is required' });
      }

      const existing = db.select().from(tags).where(eq(tags.id, id)).get();
      if (!existing) {
        return reply.status(404).send({ error: 'Tag not found' });
      }

      // Check for duplicate name
      const duplicate = db.select().from(tags).where(eq(tags.name, name.trim())).get();
      if (duplicate && duplicate.id !== id) {
        return reply.status(409).send({ error: 'A tag with this name already exists' });
      }

      db.update(tags).set({ name: name.trim() }).where(eq(tags.id, id)).run();
      const updated = db.select().from(tags).where(eq(tags.id, id)).get();
      return updated;
    },
  );

  // DELETE /:id - delete a tag
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const db = getDb();
    const id = Number(req.params.id);

    const existing = db.select().from(tags).where(eq(tags.id, id)).get();
    if (!existing) {
      return reply.status(404).send({ error: 'Tag not found' });
    }

    db.delete(tags).where(eq(tags.id, id)).run();
    return reply.status(204).send();
  });

  // POST /:id/series/:seriesId - add tag to series
  app.post<{ Params: { id: string; seriesId: string } }>(
    '/:id/series/:seriesId',
    async (req, reply) => {
      const db = getDb();
      const tagId = Number(req.params.id);
      const seriesId = Number(req.params.seriesId);

      try {
        db.insert(seriesTags).values({ tagId, seriesId }).run();
      } catch {
        // Already exists or FK violation — ignore
      }

      return reply.status(201).send({ tagId, seriesId });
    },
  );

  // DELETE /:id/series/:seriesId - remove tag from series
  app.delete<{ Params: { id: string; seriesId: string } }>(
    '/:id/series/:seriesId',
    async (req, reply) => {
      const db = getDb();
      const tagId = Number(req.params.id);
      const seriesId = Number(req.params.seriesId);

      db.delete(seriesTags)
        .where(sql`${seriesTags.tagId} = ${tagId} AND ${seriesTags.seriesId} = ${seriesId}`)
        .run();

      return reply.status(204).send();
    },
  );

  // GET /series/:seriesId - get tags for a specific series
  app.get<{ Params: { seriesId: string } }>(
    '/series/:seriesId',
    async (req) => {
      const db = getDb();
      const seriesId = Number(req.params.seriesId);

      const rows = db
        .select({ id: tags.id, name: tags.name, createdAt: tags.createdAt })
        .from(tags)
        .innerJoin(seriesTags, eq(seriesTags.tagId, tags.id))
        .where(eq(seriesTags.seriesId, seriesId))
        .orderBy(tags.name)
        .all();

      return rows;
    },
  );
}

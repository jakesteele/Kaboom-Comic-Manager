import type { FastifyInstance } from 'fastify';
import { desc } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { volumes } from '../../db/schema/index.js';
import { buildNewVolumesFeed } from '../../services/opds/acquisition.js';

const RECENT_LIMIT = 50;

export async function newVolumesFeed(app: FastifyInstance) {
  app.get('/new', async (request, reply) => {
    const baseUrl = `${request.protocol}://${request.host}`;
    const db = getDb();

    const volumesList = db.select().from(volumes)
      .orderBy(desc(volumes.createdAt))
      .limit(RECENT_LIMIT)
      .all();

    const xml = buildNewVolumesFeed(baseUrl, volumesList);

    return reply
      .type('application/atom+xml;profile=opds-catalog;kind=acquisition')
      .send(xml);
  });
}

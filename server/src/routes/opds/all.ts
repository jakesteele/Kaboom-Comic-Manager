import type { FastifyInstance } from 'fastify';
import { asc, count } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { volumes } from '../../db/schema/index.js';
import { buildAllVolumesFeed } from '../../services/opds/acquisition.js';

const PAGE_SIZE = 50;

export async function allVolumesFeed(app: FastifyInstance) {
  app.get('/all', async (request, reply) => {
    const baseUrl = `${request.protocol}://${request.host}`;
    const { page: pageParam } = request.query as { page?: string };
    const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);

    const db = getDb();

    const totalResult = db.select({ total: count() }).from(volumes).get();
    const total = totalResult?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const volumesList = db.select().from(volumes)
      .orderBy(asc(volumes.displayName))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .all();

    const xml = buildAllVolumesFeed(baseUrl, volumesList, page, totalPages);

    return reply
      .type('application/atom+xml;profile=opds-catalog;kind=acquisition')
      .send(xml);
  });
}

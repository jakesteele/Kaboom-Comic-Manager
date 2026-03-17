import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { tags, seriesTags } from '../../db/schema/index.js';
import { buildRootCatalog } from '../../services/opds/navigation.js';

export async function rootCatalog(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const baseUrl = `${request.protocol}://${request.host}`;

    // Check if any tags have series assigned
    const db = getDb();
    const tagWithSeries = db
      .select({ id: tags.id })
      .from(tags)
      .innerJoin(seriesTags, eq(seriesTags.tagId, tags.id))
      .limit(1)
      .get();

    const xml = buildRootCatalog(baseUrl, !!tagWithSeries);

    return reply
      .type('application/atom+xml;profile=opds-catalog;kind=navigation')
      .send(xml);
  });
}

import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { volumes } from '../../db/schema/index.js';
import { buildSearchResultsFeed } from '../../services/opds/acquisition.js';
import { buildOpenSearchDescription } from '../../services/opds/search.js';

export async function searchRoute(app: FastifyInstance) {
  app.get('/search', async (request, reply) => {
    const baseUrl = `${request.protocol}://${request.host}`;
    const { q } = request.query as { q?: string };

    if (!q) {
      const xml = buildOpenSearchDescription(baseUrl);
      return reply
        .type('application/opensearchdescription+xml')
        .send(xml);
    }

    const db = getDb();
    const pattern = `%${q}%`;

    const volumesList = db.select().from(volumes)
      .where(
        sql`${volumes.displayName} LIKE ${pattern}
          OR ${volumes.ciTitle} LIKE ${pattern}
          OR ${volumes.ciSeries} LIKE ${pattern}`
      )
      .all();

    const xml = buildSearchResultsFeed(baseUrl, volumesList, q);

    return reply
      .type('application/atom+xml;profile=opds-catalog;kind=acquisition')
      .send(xml);
  });
}

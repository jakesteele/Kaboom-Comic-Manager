import type { FastifyInstance } from 'fastify';
import { buildRootCatalog } from '../../services/opds/navigation.js';

export async function rootCatalog(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const baseUrl = `${request.protocol}://${request.hostname}`;
    const xml = buildRootCatalog(baseUrl);

    return reply
      .type('application/atom+xml;profile=opds-catalog;kind=navigation')
      .send(xml);
  });
}

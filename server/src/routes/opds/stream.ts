import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { volumes } from '../../db/schema/index.js';
import { extractPage } from '../../services/page-stream.js';

/**
 * OPDS-PSE page streaming route.
 * Serves individual page images from CBZ files on the fly.
 *
 * GET /opds/stream/:volumeId?page={pageNumber}&width={maxWidth}
 */
export async function streamRoute(app: FastifyInstance) {
  app.get<{
    Params: { volumeId: string };
    Querystring: { page?: string; width?: string };
  }>('/stream/:volumeId', async (request, reply) => {
    const volumeId = parseInt(request.params.volumeId, 10);
    if (isNaN(volumeId)) {
      return reply.code(400).send({ error: 'Invalid volume ID' });
    }

    const pageNumber = parseInt(request.query.page || '0', 10);
    if (isNaN(pageNumber) || pageNumber < 0) {
      return reply.code(400).send({ error: 'Invalid page number' });
    }

    const maxWidth = request.query.width ? parseInt(request.query.width, 10) : undefined;

    const db = getDb();
    const vol = db.select().from(volumes).where(eq(volumes.id, volumeId)).get();

    if (!vol) {
      return reply.code(404).send({ error: 'Volume not found' });
    }

    try {
      const result = await extractPage(vol.filePath, pageNumber, maxWidth);

      if (!result) {
        return reply.code(404).send({ error: 'Page not found' });
      }

      reply.header('Content-Type', result.contentType);
      reply.header('Content-Length', result.buffer.length);
      reply.header('Cache-Control', 'public, max-age=86400');
      return reply.send(result.buffer);
    } catch (err) {
      request.log.error(err, 'Failed to extract page');
      return reply.code(500).send({ error: 'Failed to extract page' });
    }
  });
}

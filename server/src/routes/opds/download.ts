import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { getDb } from '../../db/connection.js';
import { volumes } from '../../db/schema/index.js';

export async function downloadRoute(app: FastifyInstance) {
  app.get('/download/:volumeId', async (request, reply) => {
    const { volumeId: volumeIdParam } = request.params as { volumeId: string };
    const volumeId = parseInt(volumeIdParam, 10);

    if (isNaN(volumeId)) {
      return reply.status(400).send({ error: 'Invalid volume ID' });
    }

    const db = getDb();
    const volume = db.select().from(volumes).where(eq(volumes.id, volumeId)).get();

    if (!volume) {
      return reply.status(404).send({ error: 'Volume not found' });
    }

    if (!existsSync(volume.filePath)) {
      return reply.status(404).send({ error: 'File not found on disk' });
    }

    const stat = statSync(volume.filePath);
    const fileName = basename(volume.filePath);
    const contentType = /\.epub$/i.test(volume.filePath)
      ? 'application/epub+zip'
      : 'application/vnd.comicbook+zip';

    reply.raw.writeHead(200, {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Content-Length': stat.size,
    });

    const stream = createReadStream(volume.filePath);
    stream.pipe(reply.raw);

    return reply;
  });
}

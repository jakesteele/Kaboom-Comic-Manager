import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { existsSync, createReadStream, statSync } from 'node:fs';
import { getDb } from '../../db/connection.js';
import { volumes, series } from '../../db/schema/index.js';
import { generateThumbnail, generateCover } from '../../services/thumbnail.js';

export async function thumbnailRoute(app: FastifyInstance) {
  // Serve cached thumbnail (300px wide)
  app.get('/thumbnail/:volumeId', async (request, reply) => {
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

    let thumbPath = volume.thumbnailPath;

    if (!thumbPath || !existsSync(thumbPath)) {
      thumbPath = await generateThumbnail(volume.filePath, volume.id);

      if (!thumbPath) {
        return reply.status(404).send({ error: 'Thumbnail not available' });
      }

      db.update(volumes).set({ thumbnailPath: thumbPath }).where(eq(volumes.id, volumeId)).run();
    }

    const stat = statSync(thumbPath);

    reply.raw.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=86400',
    });

    const stream = createReadStream(thumbPath);
    stream.pipe(reply.raw);

    return reply;
  });

  // Serve full-size cover (800px wide)
  app.get('/cover/:volumeId', async (request, reply) => {
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

    const coverPath = await generateCover(volume.filePath, volume.id);

    if (!coverPath) {
      return reply.status(404).send({ error: 'Cover not available' });
    }

    const stat = statSync(coverPath);

    reply.raw.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=86400',
    });

    const stream = createReadStream(coverPath);
    stream.pipe(reply.raw);

    return reply;
  });

  // Serve series thumbnail (uses the series' stored thumbnail path)
  app.get('/thumbnail/series/:seriesId', async (request, reply) => {
    const { seriesId: seriesIdParam } = request.params as { seriesId: string };
    const seriesId = parseInt(seriesIdParam, 10);

    if (isNaN(seriesId)) {
      return reply.status(400).send({ error: 'Invalid series ID' });
    }

    const db = getDb();
    const seriesData = db.select().from(series).where(eq(series.id, seriesId)).get();

    if (!seriesData || !seriesData.thumbnailPath || !existsSync(seriesData.thumbnailPath)) {
      return reply.status(404).send({ error: 'Thumbnail not available' });
    }

    const stat = statSync(seriesData.thumbnailPath);

    reply.raw.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=86400',
    });

    const stream = createReadStream(seriesData.thumbnailPath);
    stream.pipe(reply.raw);

    return reply;
  });
}

import type { FastifyInstance } from 'fastify';
import { eq, asc } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { seasons, volumes, series } from '../../db/schema/index.js';
import { buildSeasonFeed } from '../../services/opds/acquisition.js';

export async function seasonFeed(app: FastifyInstance) {
  app.get('/season/:id', async (request, reply) => {
    const baseUrl = `${request.protocol}://${request.hostname}`;
    const { id } = request.params as { id: string };
    const seasonId = parseInt(id, 10);

    if (isNaN(seasonId)) {
      return reply.status(400).send({ error: 'Invalid season ID' });
    }

    const db = getDb();

    const seasonData = db.select().from(seasons).where(eq(seasons.id, seasonId)).get();
    if (!seasonData) {
      return reply.status(404).send({ error: 'Season not found' });
    }

    const parentSeries = db.select().from(series).where(eq(series.id, seasonData.seriesId)).get();
    const seriesName = parentSeries?.name ?? 'Unknown Series';

    const volumesList = db.select().from(volumes)
      .where(eq(volumes.seasonId, seasonId))
      .orderBy(asc(volumes.sortOrder), asc(volumes.volumeNumber))
      .all();

    const xml = buildSeasonFeed(baseUrl, seasonData, volumesList, seriesName);

    return reply
      .type('application/atom+xml;profile=opds-catalog;kind=acquisition')
      .send(xml);
  });
}

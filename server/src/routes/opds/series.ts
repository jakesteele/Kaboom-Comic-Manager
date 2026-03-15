import type { FastifyInstance } from 'fastify';
import { eq, count, asc } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { series, seasons, volumes } from '../../db/schema/index.js';
import { buildSeriesListFeed, buildSeriesDetailFeed } from '../../services/opds/navigation.js';

const PAGE_SIZE = 20;

export async function seriesFeed(app: FastifyInstance) {
  // Paginated list of all series
  app.get('/series', async (request, reply) => {
    const baseUrl = `${request.protocol}://${request.host}`;
    const { page: pageParam } = request.query as { page?: string };
    const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);

    const db = getDb();

    const totalResult = db.select({ total: count() }).from(series).get();
    const total = totalResult?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const seriesList = db.select().from(series)
      .orderBy(asc(series.sortTitle))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .all();

    const xml = buildSeriesListFeed(baseUrl, seriesList, page, totalPages);

    return reply
      .type('application/atom+xml;profile=opds-catalog;kind=navigation')
      .send(xml);
  });

  // Detail view: seasons within a single series
  app.get('/series/:id', async (request, reply) => {
    const baseUrl = `${request.protocol}://${request.host}`;
    const { id } = request.params as { id: string };
    const seriesId = parseInt(id, 10);

    if (isNaN(seriesId)) {
      return reply.status(400).send({ error: 'Invalid series ID' });
    }

    const db = getDb();

    const seriesData = db.select().from(series).where(eq(series.id, seriesId)).get();
    if (!seriesData) {
      return reply.status(404).send({ error: 'Series not found' });
    }

    const seasonsList = db.select().from(seasons)
      .where(eq(seasons.seriesId, seriesId))
      .orderBy(asc(seasons.sortOrder))
      .all();

    // Get first volume ID per season for thumbnails
    const seasonThumbnails = new Map<number, number>();
    for (const season of seasonsList) {
      const firstVol = db.select({ id: volumes.id }).from(volumes)
        .where(eq(volumes.seasonId, season.id))
        .orderBy(asc(volumes.sortOrder))
        .limit(1)
        .get();
      if (firstVol) {
        seasonThumbnails.set(season.id, firstVol.id);
      }
    }

    const xml = buildSeriesDetailFeed(baseUrl, seriesData, seasonsList, seasonThumbnails);

    return reply
      .type('application/atom+xml;profile=opds-catalog;kind=navigation')
      .send(xml);
  });
}

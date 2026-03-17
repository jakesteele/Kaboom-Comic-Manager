import type { FastifyInstance } from 'fastify';
import { eq, sql, asc } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { tags, seriesTags, series } from '../../db/schema/index.js';
import { NAVIGATION_TYPE } from '@opds/shared';
import {
  createFeedDocument as createFeed,
  addNavigationEntry as addNavEntry,
  serializeToXml as serialize,
} from '../../services/opds/feed-builder.js';

export async function tagsFeed(app: FastifyInstance) {
  // List all tags that have at least 1 series
  app.get('/tags', async (request, reply) => {
    const baseUrl = `${request.protocol}://${request.host}`;
    const db = getDb();

    const tagsList = db
      .select({
        id: tags.id,
        name: tags.name,
        seriesCount: sql<number>`count(${seriesTags.seriesId})`,
      })
      .from(tags)
      .innerJoin(seriesTags, eq(seriesTags.tagId, tags.id))
      .groupBy(tags.id)
      .having(sql`count(${seriesTags.seriesId}) > 0`)
      .orderBy(tags.name)
      .all();

    const now = new Date().toISOString();
    const doc = createFeed({
      id: `${baseUrl}/opds/tags`,
      title: 'By Tags',
      baseUrl,
      selfHref: `${baseUrl}/opds/tags`,
      feedType: NAVIGATION_TYPE,
    });

    for (const tag of tagsList) {
      addNavEntry(doc, {
        id: `${baseUrl}/opds/tags/${tag.id}`,
        title: tag.name,
        href: `${baseUrl}/opds/tags/${tag.id}`,
        type: NAVIGATION_TYPE,
        content: `${tag.seriesCount} series`,
        updated: now,
      });
    }

    return reply
      .type('application/atom+xml;profile=opds-catalog;kind=navigation')
      .send(serialize(doc));
  });

  // List series within a specific tag
  app.get('/tags/:id', async (request, reply) => {
    const baseUrl = `${request.protocol}://${request.host}`;
    const { id } = request.params as { id: string };
    const tagId = parseInt(id, 10);

    if (isNaN(tagId)) {
      return reply.status(400).send({ error: 'Invalid tag ID' });
    }

    const db = getDb();

    const tag = db.select().from(tags).where(eq(tags.id, tagId)).get();
    if (!tag) {
      return reply.status(404).send({ error: 'Tag not found' });
    }

    // Get all series in this tag
    const taggedSeries = db
      .select({
        id: series.id,
        name: series.name,
        sortTitle: series.sortTitle,
        thumbnailPath: series.thumbnailPath,
        updatedAt: series.updatedAt,
      })
      .from(series)
      .innerJoin(seriesTags, eq(seriesTags.seriesId, series.id))
      .where(eq(seriesTags.tagId, tagId))
      .orderBy(asc(series.sortTitle))
      .all();

    const now = new Date().toISOString();
    const doc = createFeed({
      id: `${baseUrl}/opds/tags/${tagId}`,
      title: tag.name,
      baseUrl,
      selfHref: `${baseUrl}/opds/tags/${tagId}`,
      feedType: NAVIGATION_TYPE,
    });

    for (const s of taggedSeries) {
      const updated = (s.updatedAt instanceof Date ? s.updatedAt : new Date(s.updatedAt)).toISOString();
      const thumbnailHref = s.thumbnailPath
        ? `${baseUrl}/opds/thumbnail/series/${s.id}`
        : undefined;

      addNavEntry(doc, {
        id: `${baseUrl}/opds/series/${s.id}`,
        title: s.name,
        href: `${baseUrl}/opds/series/${s.id}`,
        type: NAVIGATION_TYPE,
        thumbnailHref,
        updated,
      });
    }

    return reply
      .type('application/atom+xml;profile=opds-catalog;kind=navigation')
      .send(serialize(doc));
  });
}

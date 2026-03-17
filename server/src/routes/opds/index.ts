import type { FastifyInstance } from 'fastify';
import { rootCatalog } from './root.js';
import { seriesFeed } from './series.js';
import { seasonFeed } from './season.js';
import { downloadRoute } from './download.js';
import { thumbnailRoute } from './thumbnail.js';
import { searchRoute } from './search.js';
import { streamRoute } from './stream.js';
import { newVolumesFeed } from './new.js';
import { allVolumesFeed } from './all.js';
import { tagsFeed } from './tags.js';

export async function registerOpdsRoutes(app: FastifyInstance) {
  await app.register(rootCatalog);
  await app.register(seriesFeed);
  await app.register(seasonFeed);
  await app.register(downloadRoute);
  await app.register(thumbnailRoute);
  await app.register(searchRoute);
  await app.register(streamRoute);
  await app.register(newVolumesFeed);
  await app.register(allVolumesFeed);
  await app.register(tagsFeed);
}

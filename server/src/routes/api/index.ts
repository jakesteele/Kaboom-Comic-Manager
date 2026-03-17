import type { FastifyInstance } from 'fastify';
import { libraryRoutes } from './library.js';
import { seriesRoutes } from './series.js';
import { seasonsRoutes } from './seasons.js';
import { volumesRoutes } from './volumes.js';
import { groupingRoutes } from './grouping.js';
import { settingsRoutes } from './settings.js';
import { tagsRoutes } from './tags.js';
import { usersRoutes } from './users.js';

export async function registerApiRoutes(app: FastifyInstance) {
  await app.register(libraryRoutes, { prefix: '/library' });
  await app.register(seriesRoutes, { prefix: '/series' });
  await app.register(seasonsRoutes, { prefix: '/seasons' });
  await app.register(volumesRoutes, { prefix: '/volumes' });
  await app.register(groupingRoutes, { prefix: '/grouping' });
  await app.register(settingsRoutes, { prefix: '/settings' });
  await app.register(tagsRoutes, { prefix: '/tags' });
  await app.register(usersRoutes, { prefix: '/users' });
}

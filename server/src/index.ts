import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.js';
import { ensureSchema } from './db/migrate.js';
import { getDb } from './db/connection.js';
import { registerApiRoutes } from './routes/api/index.js';
import { registerOpdsRoutes } from './routes/opds/index.js';
import { buildRootCatalog } from './services/opds/navigation.js';
import { WatcherManager } from './services/watcher.js';

const app = Fastify({ logger: true });

// Ensure data directories exist
mkdirSync(config.thumbnailDir, { recursive: true });

// Ensure database schema
ensureSchema();

// Register plugins
await app.register(cors, { origin: true });
await app.register(fastifyStatic, {
  root: config.thumbnailDir,
  prefix: '/thumbnails/',
  decorateReply: false,
});

// Register routes
await app.register(registerApiRoutes, { prefix: '/api' });
await app.register(registerOpdsRoutes, { prefix: '/opds' });

// Health check
app.get('/health', async () => ({ status: 'ok' }));

// Root route: serve SPA for browsers, OPDS for XML-only clients (Panels)
app.get('/', async (request, reply) => {
  const accept = (request.headers.accept || '').toLowerCase();
  // Browsers send text/html — serve the SPA
  if (accept.includes('text/html')) {
    if (config.webDir) {
      const indexPath = join(config.webDir, 'index.html');
      if (existsSync(indexPath)) {
        return reply.type('text/html').send(readFileSync(indexPath, 'utf-8'));
      }
    }
    return reply.redirect('/opds');
  }
  // OPDS clients (Panels etc) — serve the catalog
  const baseUrl = `${request.protocol}://${request.host}`;
  const xml = buildRootCatalog(baseUrl);
  return reply
    .type('application/atom+xml;profile=opds-catalog;kind=navigation')
    .send(xml);
});

// Serve frontend static assets in production
if (config.webDir && existsSync(config.webDir)) {
  const indexPath = join(config.webDir, 'index.html');
  await app.register(fastifyStatic, {
    root: config.webDir,
    prefix: '/',
    decorateReply: false,
    wildcard: false,
  });
  if (existsSync(indexPath)) {
    const indexHtml = readFileSync(indexPath, 'utf-8');
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/opds/') ||
          request.url.startsWith('/thumbnails/') || request.url === '/health') {
        reply.code(404).send({ error: 'Not found' });
        return;
      }
      reply.type('text/html').send(indexHtml);
    });
  }
}

// Start watcher for existing watch directories
const watcherManager = new WatcherManager(getDb());

// Graceful shutdown
const shutdown = async () => {
  app.log.info('Shutting down...');
  await watcherManager.stopAll();
  await app.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`Kaboom running at http://${config.host}:${config.port}`);
  app.log.info(`OPDS catalog: http://${config.host}:${config.port}/opds`);

  // Initialize watchers after server is up
  await watcherManager.initializeFromDb();
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

export { app };

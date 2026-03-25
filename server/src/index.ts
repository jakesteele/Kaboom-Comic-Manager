import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { ensureSchema } from './db/migrate.js';
import { getDb } from './db/connection.js';
import { registerApiRoutes } from './routes/api/index.js';
import { registerOpdsRoutes } from './routes/opds/index.js';
import { buildRootCatalog } from './services/opds/navigation.js';
import { WatcherManager } from './services/watcher.js';
import { users, tags, seriesTags } from './db/schema/index.js';
import { eq } from 'drizzle-orm';
import { compareSync } from 'bcryptjs';

const app = Fastify({ logger: true });

// Ensure data directories exist
mkdirSync(config.thumbnailDir, { recursive: true });

// Ensure database schema
ensureSchema();

// JWT secret: persist in data dir so tokens survive restarts
const jwtSecretPath = resolve(config.dataDir, '.jwt-secret');
let jwtSecret: string;
if (existsSync(jwtSecretPath)) {
  jwtSecret = readFileSync(jwtSecretPath, 'utf-8').trim();
} else {
  jwtSecret = randomBytes(32).toString('hex');
  writeFileSync(jwtSecretPath, jwtSecret, 'utf-8');
}

// Register plugins
await app.register(cors, { origin: true });
await app.register(fastifyJwt, { secret: jwtSecret });
await app.register(fastifyStatic, {
  root: config.thumbnailDir,
  prefix: '/thumbnails/',
  decorateReply: false,
});

// Auth middleware: protect routes when users exist in the database
// Public routes that never require auth:
const PUBLIC_PATHS = [
  '/api/users/setup-required',
  '/api/users/setup',
  '/api/users/login',
  '/health',
];

app.addHook('onRequest', async (request, reply) => {
  const url = request.url.split('?')[0];

  // Public routes — always allowed
  if (PUBLIC_PATHS.includes(url) || url === '/' || url.startsWith('/_nuxt/') || url.startsWith('/thumbnails/')) {
    return;
  }

  // Check if any users exist (auth is only enforced when users are set up)
  const db = getDb();
  const hasUsers = db.select().from(users).limit(1).get();
  if (!hasUsers) return;

  // OPDS routes use HTTP Basic auth (for reader apps like Panels)
  if (url.startsWith('/opds')) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      reply.header('WWW-Authenticate', 'Basic realm="Kaboom"');
      return reply.code(401).send({ error: 'Authentication required' });
    }
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    const email = decoded.substring(0, colonIdx);
    const password = decoded.substring(colonIdx + 1);
    const user = db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
    if (!user || !compareSync(password, user.passwordHash)) {
      reply.header('WWW-Authenticate', 'Basic realm="Kaboom"');
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    return;
  }

  // API routes use JWT Bearer auth
  if (url.startsWith('/api/')) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Not authenticated' });
    }

    // Read-only enforcement for 'user' role (non-admin)
    const payload = request.user as { role: string };
    if (payload.role !== 'admin') {
      const method = request.method;
      // Users can only GET (read) data, not modify it — except changing their own password
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        if (url !== '/api/users/me/password') {
          return reply.code(403).send({ error: 'Read-only access. Admin required for modifications.' });
        }
      }
    }
  }
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

  // OPDS clients (Panels etc) — require Basic auth if users exist
  const db = getDb();
  const hasUsers = db.select().from(users).limit(1).get();
  if (hasUsers) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      reply.header('WWW-Authenticate', 'Basic realm="Kaboom"');
      return reply.code(401).send({ error: 'Authentication required' });
    }
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) {
      reply.header('WWW-Authenticate', 'Basic realm="Kaboom"');
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    const email = decoded.substring(0, colonIdx);
    const password = decoded.substring(colonIdx + 1);
    const user = db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
    if (!user || !compareSync(password, user.passwordHash)) {
      reply.header('WWW-Authenticate', 'Basic realm="Kaboom"');
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
  }

  // Serve the catalog
  const baseUrl = `${request.protocol}://${request.host}`;
  const hasTagsSeries = db.select({ id: tags.id }).from(tags)
    .innerJoin(seriesTags, eq(seriesTags.tagId, tags.id)).limit(1).get();
  const xml = buildRootCatalog(baseUrl, !!hasTagsSeries);
  return reply
    .type('application/atom+xml;profile=opds-catalog;kind=navigation')
    .send(xml);
});

// Serve frontend static assets in production
if (config.webDir && existsSync(config.webDir)) {
  const indexPath = join(config.webDir, 'index.html');
  const nuxtDir = join(config.webDir, '_nuxt');

  // Serve Nuxt JS/CSS chunks from /_nuxt/ — avoids route conflict with app.get('/')
  if (existsSync(nuxtDir)) {
    await app.register(fastifyStatic, {
      root: nuxtDir,
      prefix: '/_nuxt/',
      decorateReply: false,
    });
  }

  // SPA fallback: serve index.html for any unmatched non-API route
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

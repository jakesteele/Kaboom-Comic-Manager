import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { settings } from '../db/schema/index.js';

function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row ? JSON.parse(row.value) : null;
}

export async function authPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Only apply to /opds routes
    if (!request.url.startsWith('/opds')) return;

    const authEnabled = getSetting('authEnabled');
    if (authEnabled !== true && authEnabled !== 'true') return;

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      reply.header('WWW-Authenticate', 'Basic realm="Kaboom"');
      reply.code(401).send({ error: 'Authentication required' });
      return;
    }

    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) {
      reply.code(401).send({ error: 'Invalid credentials' });
      return;
    }

    const username = decoded.substring(0, colonIdx);
    const password = decoded.substring(colonIdx + 1);

    const storedUsername = getSetting('authUsername');
    const storedPassword = getSetting('authPassword');

    if (username !== storedUsername || password !== storedPassword) {
      reply.header('WWW-Authenticate', 'Basic realm="Kaboom"');
      reply.code(401).send({ error: 'Invalid credentials' });
      return;
    }
  });
}

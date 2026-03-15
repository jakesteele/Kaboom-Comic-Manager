import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { settings } from '../../db/schema/index.js';

export async function settingsRoutes(app: FastifyInstance) {
  // GET / - get all settings as object
  app.get('/', async () => {
    const db = getDb();
    const rows = db.select().from(settings).all();

    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }

    return result;
  });

  // PATCH / - update settings (partial object)
  app.patch<{ Body: Record<string, string> }>('/', async (req, reply) => {
    const db = getDb();
    const updates = req.body;

    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: 'Request body must be a non-empty object' });
    }

    for (const [key, value] of Object.entries(updates)) {
      const existing = db.select().from(settings).where(eq(settings.key, key)).get();
      if (existing) {
        db.update(settings).set({ value: String(value) }).where(eq(settings.key, key)).run();
      } else {
        db.insert(settings).values({ key, value: String(value) }).run();
      }
    }

    // Return full settings object
    const rows = db.select().from(settings).all();
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }

    return result;
  });
}

import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { groupingSuggestions } from '../../db/schema/index.js';
import { acceptGroupingSuggestion, rejectGroupingSuggestion } from '../../services/grouper.js';

export async function groupingRoutes(app: FastifyInstance) {
  // GET /suggestions - list pending grouping suggestions
  app.get('/suggestions', async () => {
    const db = getDb();
    const pending = db
      .select()
      .from(groupingSuggestions)
      .where(eq(groupingSuggestions.status, 'pending'))
      .all();

    return pending;
  });

  // POST /suggestions/:id/accept - accept suggestion
  app.post<{ Params: { id: string } }>('/suggestions/:id/accept', async (req, reply) => {
    const db = getDb();
    const id = Number(req.params.id);

    const suggestion = db
      .select()
      .from(groupingSuggestions)
      .where(eq(groupingSuggestions.id, id))
      .get();

    if (!suggestion) {
      return reply.status(404).send({ error: 'Suggestion not found' });
    }
    if (suggestion.status !== 'pending') {
      return reply.status(409).send({ error: `Suggestion already ${suggestion.status}` });
    }

    acceptGroupingSuggestion(db, id);
    return { message: 'Suggestion accepted' };
  });

  // POST /suggestions/:id/reject - reject suggestion
  app.post<{ Params: { id: string } }>('/suggestions/:id/reject', async (req, reply) => {
    const db = getDb();
    const id = Number(req.params.id);

    const suggestion = db
      .select()
      .from(groupingSuggestions)
      .where(eq(groupingSuggestions.id, id))
      .get();

    if (!suggestion) {
      return reply.status(404).send({ error: 'Suggestion not found' });
    }
    if (suggestion.status !== 'pending') {
      return reply.status(409).send({ error: `Suggestion already ${suggestion.status}` });
    }

    rejectGroupingSuggestion(db, id);
    return { message: 'Suggestion rejected' };
  });
}

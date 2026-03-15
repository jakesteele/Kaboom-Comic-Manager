import type { FastifyInstance } from 'fastify';
import { access } from 'node:fs/promises';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../db/connection.js';
import { watchDirectories, scanLog } from '../../db/schema/index.js';
import { scanDirectory, scanAll } from '../../services/scanner.js';

let scanningStatus: { running: boolean; directory?: string; startedAt?: Date } = { running: false };

export async function libraryRoutes(app: FastifyInstance) {
  // GET /directories - list all watch directories with their scan logs
  app.get('/directories', async () => {
    const db = getDb();
    const dirs = db.select().from(watchDirectories).all();
    return dirs;
  });

  // POST /directories - add a watch directory
  app.post<{ Body: { path: string } }>('/directories', async (req, reply) => {
    const { path } = req.body;
    if (!path) {
      return reply.status(400).send({ error: 'path is required' });
    }

    try {
      await access(path);
    } catch {
      return reply.status(400).send({ error: 'Directory does not exist or is not accessible' });
    }

    const db = getDb();
    const existing = db.select().from(watchDirectories).where(eq(watchDirectories.path, path)).get();
    if (existing) {
      return reply.status(409).send({ error: 'Directory already added' });
    }

    const result = db.insert(watchDirectories).values({ path }).returning().get();
    return reply.status(201).send(result);
  });

  // DELETE /directories/:id - remove a watch directory
  app.delete<{ Params: { id: string } }>('/directories/:id', async (req, reply) => {
    const db = getDb();
    const id = Number(req.params.id);
    const dir = db.select().from(watchDirectories).where(eq(watchDirectories.id, id)).get();
    if (!dir) {
      return reply.status(404).send({ error: 'Directory not found' });
    }

    db.delete(watchDirectories).where(eq(watchDirectories.id, id)).run();
    return reply.status(204).send();
  });

  // POST /directories/:id/scan - trigger scan for specific directory
  app.post<{ Params: { id: string } }>('/directories/:id/scan', async (req, reply) => {
    const db = getDb();
    const id = Number(req.params.id);
    const dir = db.select().from(watchDirectories).where(eq(watchDirectories.id, id)).get();
    if (!dir) {
      return reply.status(404).send({ error: 'Directory not found' });
    }

    if (scanningStatus.running) {
      return reply.status(409).send({ error: 'A scan is already in progress' });
    }

    scanningStatus = { running: true, directory: dir.path, startedAt: new Date() };

    setImmediate(async () => {
      try {
        await scanDirectory(db, id);
      } catch (err) {
        console.error('Scan failed:', err);
      } finally {
        scanningStatus = { running: false };
      }
    });

    return reply.status(202).send({ message: 'Scan started', directoryId: id });
  });

  // POST /scan-all - trigger scan of all directories
  app.post('/scan-all', async (_req, reply) => {
    if (scanningStatus.running) {
      return reply.status(409).send({ error: 'A scan is already in progress' });
    }

    const db = getDb();
    scanningStatus = { running: true, startedAt: new Date() };

    setImmediate(async () => {
      try {
        await scanAll(db);
      } catch (err) {
        console.error('Scan all failed:', err);
      } finally {
        scanningStatus = { running: false };
      }
    });

    return reply.status(202).send({ message: 'Scan started for all directories' });
  });

  // GET /scan-status - return current scan status
  app.get('/scan-status', async () => {
    const db = getDb();
    const latestLog = db.select().from(scanLog).orderBy(desc(scanLog.startedAt)).limit(1).get();
    return {
      ...scanningStatus,
      latestScan: latestLog ?? null,
    };
  });
}

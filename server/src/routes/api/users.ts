import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { hashSync, compareSync } from 'bcryptjs';
import { getDb } from '../../db/connection.js';
import { users } from '../../db/schema/index.js';

export async function usersRoutes(app: FastifyInstance) {
  // GET /setup-required - check if initial setup is needed (no users exist)
  app.get('/setup-required', async () => {
    const db = getDb();
    const count = db.select().from(users).limit(1).get();
    return { setupRequired: !count };
  });

  // POST /setup - create the first admin user (only works when no users exist)
  app.post<{ Body: { email: string; password: string } }>('/setup', async (req, reply) => {
    const db = getDb();
    const existing = db.select().from(users).limit(1).get();
    if (existing) {
      return reply.status(403).send({ error: 'Setup already completed' });
    }

    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return reply.status(400).send({ error: 'email and password are required' });
    }
    if (password.length < 6) {
      return reply.status(400).send({ error: 'Password must be at least 6 characters' });
    }

    const passwordHash = hashSync(password, 10);
    const user = db
      .insert(users)
      .values({ email: email.trim().toLowerCase(), passwordHash, role: 'admin' })
      .returning()
      .get();

    const token = app.jwt.sign({ id: user.id, email: user.email, role: user.role });
    return { user: { id: user.id, email: user.email, role: user.role }, token };
  });

  // POST /login - authenticate and return JWT
  app.post<{ Body: { email: string; password: string } }>('/login', async (req, reply) => {
    const db = getDb();
    const { email, password } = req.body;

    if (!email || !password) {
      return reply.status(400).send({ error: 'email and password are required' });
    }

    const user = db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).get();
    if (!user || !compareSync(password, user.passwordHash)) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const token = app.jwt.sign({ id: user.id, email: user.email, role: user.role });
    return { user: { id: user.id, email: user.email, role: user.role }, token };
  });

  // GET /me - get current user info (requires auth)
  app.get('/me', async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Not authenticated' });
    }
    const payload = req.user as { id: number; email: string; role: string };
    return { id: payload.id, email: payload.email, role: payload.role };
  });

  // PATCH /me/password - update own password
  app.patch<{ Body: { currentPassword: string; newPassword: string } }>(
    '/me/password',
    async (req, reply) => {
      try {
        await req.jwtVerify();
      } catch {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      const payload = req.user as { id: number };
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return reply.status(400).send({ error: 'currentPassword and newPassword are required' });
      }
      if (newPassword.length < 6) {
        return reply.status(400).send({ error: 'Password must be at least 6 characters' });
      }

      const db = getDb();
      const user = db.select().from(users).where(eq(users.id, payload.id)).get();
      if (!user || !compareSync(currentPassword, user.passwordHash)) {
        return reply.status(401).send({ error: 'Current password is incorrect' });
      }

      const passwordHash = hashSync(newPassword, 10);
      db.update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, payload.id))
        .run();

      return { message: 'Password updated' };
    },
  );

  // GET / - list all users (admin only)
  app.get('/', async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const payload = req.user as { role: string };
    if (payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const db = getDb();
    const rows = db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    }).from(users).orderBy(users.email).all();

    return rows;
  });

  // POST / - create a user (admin only)
  app.post<{ Body: { email: string; password: string; role?: string } }>(
    '/',
    async (req, reply) => {
      try {
        await req.jwtVerify();
      } catch {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      const payload = req.user as { role: string };
      if (payload.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin access required' });
      }

      const { email, password, role } = req.body;
      if (!email?.trim() || !password) {
        return reply.status(400).send({ error: 'email and password are required' });
      }
      if (password.length < 6) {
        return reply.status(400).send({ error: 'Password must be at least 6 characters' });
      }

      const userRole = role === 'admin' ? 'admin' : 'user';
      const db = getDb();

      const existing = db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).get();
      if (existing) {
        return reply.status(409).send({ error: 'A user with this email already exists' });
      }

      const passwordHash = hashSync(password, 10);
      const user = db
        .insert(users)
        .values({ email: email.trim().toLowerCase(), passwordHash, role: userRole })
        .returning()
        .get();

      return reply.status(201).send({ id: user.id, email: user.email, role: user.role });
    },
  );

  // PATCH /:id - update user role (admin only)
  app.patch<{ Params: { id: string }; Body: { role?: string; password?: string } }>(
    '/:id',
    async (req, reply) => {
      try {
        await req.jwtVerify();
      } catch {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      const payload = req.user as { role: string };
      if (payload.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin access required' });
      }

      const db = getDb();
      const id = Number(req.params.id);
      const existing = db.select().from(users).where(eq(users.id, id)).get();
      if (!existing) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const currentUser = req.user as { id: number; role: string };
      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (req.body.role && (req.body.role === 'admin' || req.body.role === 'user')) {
        // Cannot change your own role
        if (id === currentUser.id) {
          return reply.status(400).send({ error: 'Cannot change your own role' });
        }
        // Cannot demote if this is the last admin
        if (existing.role === 'admin' && req.body.role === 'user') {
          const adminCount = db.select().from(users).where(eq(users.role, 'admin')).all().length;
          if (adminCount <= 1) {
            return reply.status(400).send({ error: 'Cannot demote the last admin user' });
          }
        }
        updates.role = req.body.role;
      }
      if (req.body.password) {
        if (req.body.password.length < 6) {
          return reply.status(400).send({ error: 'Password must be at least 6 characters' });
        }
        updates.passwordHash = hashSync(req.body.password, 10);
      }

      db.update(users).set(updates).where(eq(users.id, id)).run();

      const updated = db.select({
        id: users.id,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      }).from(users).where(eq(users.id, id)).get();

      return updated;
    },
  );

  // DELETE /:id - delete a user (admin only, cannot delete self)
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const payload = req.user as { id: number; role: string };
    if (payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const id = Number(req.params.id);
    if (id === payload.id) {
      return reply.status(400).send({ error: 'Cannot delete your own account' });
    }

    const db = getDb();
    const existing = db.select().from(users).where(eq(users.id, id)).get();
    if (!existing) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Cannot delete the last admin
    if (existing.role === 'admin') {
      const adminCount = db.select().from(users).where(eq(users.role, 'admin')).all().length;
      if (adminCount <= 1) {
        return reply.status(400).send({ error: 'Cannot delete the last admin user' });
      }
    }

    db.delete(users).where(eq(users.id, id)).run();
    return reply.status(204).send();
  });
}

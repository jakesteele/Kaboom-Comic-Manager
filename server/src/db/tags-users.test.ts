import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { hashSync, compareSync } from 'bcryptjs';
import { createTestDb, type TestDb } from './test-helpers.js';
import { tags, seriesTags, users, series, seasons } from './schema/index.js';

let db: TestDb;

beforeEach(() => {
  db = createTestDb();
});

// ─── Helper: create a series ────────────────────────────────────────────

function createSeries(name: string) {
  return db.insert(series).values({
    name,
    nameNormalized: name.toLowerCase(),
    sortTitle: name.toLowerCase(),
  }).returning().get();
}

function createSeasonForSeries(seriesId: number, name: string) {
  return db.insert(seasons).values({ seriesId, name, sortOrder: 0 }).returning().get();
}

// ─── Tags CRUD ──────────────────────────────────────────────────────────

describe('Tags CRUD', () => {
  it('creates a tag', () => {
    const tag = db.insert(tags).values({ name: 'Manga' }).returning().get();
    expect(tag.id).toBeDefined();
    expect(tag.name).toBe('Manga');
  });

  it('enforces unique tag names', () => {
    db.insert(tags).values({ name: 'Action' }).run();
    expect(() => {
      db.insert(tags).values({ name: 'Action' }).run();
    }).toThrow();
  });

  it('lists all tags', () => {
    db.insert(tags).values({ name: 'Manga' }).run();
    db.insert(tags).values({ name: 'Comics' }).run();
    db.insert(tags).values({ name: 'Action' }).run();
    const allTags = db.select().from(tags).all();
    expect(allTags).toHaveLength(3);
  });

  it('renames a tag', () => {
    const tag = db.insert(tags).values({ name: 'Old Name' }).returning().get();
    db.update(tags).set({ name: 'New Name' }).where(eq(tags.id, tag.id)).run();
    const updated = db.select().from(tags).where(eq(tags.id, tag.id)).get();
    expect(updated!.name).toBe('New Name');
  });

  it('deletes a tag', () => {
    const tag = db.insert(tags).values({ name: 'ToDelete' }).returning().get();
    db.delete(tags).where(eq(tags.id, tag.id)).run();
    const found = db.select().from(tags).where(eq(tags.id, tag.id)).get();
    expect(found).toBeUndefined();
  });
});

// ─── Series-Tag relationships ───────────────────────────────────────────

describe('Series-Tag relationships', () => {
  it('assigns a tag to a series', () => {
    const s = createSeries('One Piece');
    const tag = db.insert(tags).values({ name: 'Manga' }).returning().get();
    db.insert(seriesTags).values({ seriesId: s.id, tagId: tag.id }).run();

    const links = db.select().from(seriesTags).all();
    expect(links).toHaveLength(1);
    expect(links[0].seriesId).toBe(s.id);
    expect(links[0].tagId).toBe(tag.id);
  });

  it('prevents duplicate tag assignment', () => {
    const s = createSeries('Naruto');
    const tag = db.insert(tags).values({ name: 'Action' }).returning().get();
    db.insert(seriesTags).values({ seriesId: s.id, tagId: tag.id }).run();

    expect(() => {
      db.insert(seriesTags).values({ seriesId: s.id, tagId: tag.id }).run();
    }).toThrow();
  });

  it('allows multiple tags on a series', () => {
    const s = createSeries('Dragon Ball');
    const t1 = db.insert(tags).values({ name: 'Action' }).returning().get();
    const t2 = db.insert(tags).values({ name: 'Manga' }).returning().get();
    const t3 = db.insert(tags).values({ name: 'Shonen' }).returning().get();

    db.insert(seriesTags).values({ seriesId: s.id, tagId: t1.id }).run();
    db.insert(seriesTags).values({ seriesId: s.id, tagId: t2.id }).run();
    db.insert(seriesTags).values({ seriesId: s.id, tagId: t3.id }).run();

    const links = db.select().from(seriesTags).where(eq(seriesTags.seriesId, s.id)).all();
    expect(links).toHaveLength(3);
  });

  it('allows a tag on multiple series', () => {
    const s1 = createSeries('One Piece');
    const s2 = createSeries('Naruto');
    const tag = db.insert(tags).values({ name: 'Shonen' }).returning().get();

    db.insert(seriesTags).values({ seriesId: s1.id, tagId: tag.id }).run();
    db.insert(seriesTags).values({ seriesId: s2.id, tagId: tag.id }).run();

    const links = db.select().from(seriesTags).where(eq(seriesTags.tagId, tag.id)).all();
    expect(links).toHaveLength(2);
  });

  it('removes tag from series', () => {
    const s = createSeries('Bleach');
    const tag = db.insert(tags).values({ name: 'Action' }).returning().get();
    db.insert(seriesTags).values({ seriesId: s.id, tagId: tag.id }).run();

    db.delete(seriesTags)
      .where(eq(seriesTags.seriesId, s.id))
      .run();

    const links = db.select().from(seriesTags).all();
    expect(links).toHaveLength(0);
  });

  it('cascades on series delete', () => {
    const s = createSeries('Temp Series');
    const tag = db.insert(tags).values({ name: 'Temp' }).returning().get();
    db.insert(seriesTags).values({ seriesId: s.id, tagId: tag.id }).run();

    db.delete(series).where(eq(series.id, s.id)).run();

    const links = db.select().from(seriesTags).all();
    expect(links).toHaveLength(0);
    // Tag itself should still exist
    const tagStill = db.select().from(tags).where(eq(tags.id, tag.id)).get();
    expect(tagStill).toBeDefined();
  });

  it('cascades on tag delete', () => {
    const s = createSeries('Persistent Series');
    const tag = db.insert(tags).values({ name: 'Ephemeral' }).returning().get();
    db.insert(seriesTags).values({ seriesId: s.id, tagId: tag.id }).run();

    db.delete(tags).where(eq(tags.id, tag.id)).run();

    const links = db.select().from(seriesTags).all();
    expect(links).toHaveLength(0);
    // Series itself should still exist
    const seriesStill = db.select().from(series).where(eq(series.id, s.id)).get();
    expect(seriesStill).toBeDefined();
  });
});

// ─── Users CRUD ─────────────────────────────────────────────────────────

describe('Users CRUD', () => {
  it('creates a user with hashed password', () => {
    const hash = hashSync('password123', 10);
    const user = db.insert(users).values({
      email: 'admin@test.com',
      passwordHash: hash,
      role: 'admin',
    }).returning().get();

    expect(user.id).toBeDefined();
    expect(user.email).toBe('admin@test.com');
    expect(user.role).toBe('admin');
    expect(compareSync('password123', user.passwordHash)).toBe(true);
  });

  it('enforces unique emails', () => {
    db.insert(users).values({
      email: 'dupe@test.com',
      passwordHash: hashSync('pass', 10),
    }).run();

    expect(() => {
      db.insert(users).values({
        email: 'dupe@test.com',
        passwordHash: hashSync('pass2', 10),
      }).run();
    }).toThrow();
  });

  it('defaults role to user', () => {
    const user = db.insert(users).values({
      email: 'newuser@test.com',
      passwordHash: hashSync('pass', 10),
    }).returning().get();

    expect(user.role).toBe('user');
  });

  it('updates user role', () => {
    const user = db.insert(users).values({
      email: 'promote@test.com',
      passwordHash: hashSync('pass', 10),
      role: 'user',
    }).returning().get();

    db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id)).run();

    const updated = db.select().from(users).where(eq(users.id, user.id)).get();
    expect(updated!.role).toBe('admin');
  });

  it('updates user password', () => {
    const user = db.insert(users).values({
      email: 'changepw@test.com',
      passwordHash: hashSync('oldpass', 10),
    }).returning().get();

    const newHash = hashSync('newpass', 10);
    db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id)).run();

    const updated = db.select().from(users).where(eq(users.id, user.id)).get();
    expect(compareSync('newpass', updated!.passwordHash)).toBe(true);
    expect(compareSync('oldpass', updated!.passwordHash)).toBe(false);
  });

  it('deletes a user', () => {
    const user = db.insert(users).values({
      email: 'delete@test.com',
      passwordHash: hashSync('pass', 10),
    }).returning().get();

    db.delete(users).where(eq(users.id, user.id)).run();

    const found = db.select().from(users).where(eq(users.id, user.id)).get();
    expect(found).toBeUndefined();
  });

  it('lists users ordered by email', () => {
    db.insert(users).values({ email: 'charlie@test.com', passwordHash: hashSync('p', 10) }).run();
    db.insert(users).values({ email: 'alice@test.com', passwordHash: hashSync('p', 10) }).run();
    db.insert(users).values({ email: 'bob@test.com', passwordHash: hashSync('p', 10) }).run();

    const allUsers = db.select().from(users).orderBy(users.email).all();
    expect(allUsers.map(u => u.email)).toEqual([
      'alice@test.com',
      'bob@test.com',
      'charlie@test.com',
    ]);
  });
});

// ─── Admin protection logic ─────────────────────────────────────────────

describe('Admin protection', () => {
  it('counts admin users correctly', () => {
    db.insert(users).values({ email: 'admin1@test.com', passwordHash: hashSync('p', 10), role: 'admin' }).run();
    db.insert(users).values({ email: 'admin2@test.com', passwordHash: hashSync('p', 10), role: 'admin' }).run();
    db.insert(users).values({ email: 'user1@test.com', passwordHash: hashSync('p', 10), role: 'user' }).run();

    const adminCount = db.select().from(users).where(eq(users.role, 'admin')).all().length;
    expect(adminCount).toBe(2);
  });

  it('identifies the last admin', () => {
    db.insert(users).values({ email: 'sole-admin@test.com', passwordHash: hashSync('p', 10), role: 'admin' }).run();
    db.insert(users).values({ email: 'regular@test.com', passwordHash: hashSync('p', 10), role: 'user' }).run();

    const adminCount = db.select().from(users).where(eq(users.role, 'admin')).all().length;
    expect(adminCount).toBe(1);
  });

  it('allows demoting non-last admin', () => {
    const a1 = db.insert(users).values({ email: 'admin1@test.com', passwordHash: hashSync('p', 10), role: 'admin' }).returning().get();
    db.insert(users).values({ email: 'admin2@test.com', passwordHash: hashSync('p', 10), role: 'admin' }).run();

    const adminCount = db.select().from(users).where(eq(users.role, 'admin')).all().length;
    expect(adminCount).toBe(2);

    // Safe to demote one
    db.update(users).set({ role: 'user' }).where(eq(users.id, a1.id)).run();

    const remaining = db.select().from(users).where(eq(users.role, 'admin')).all().length;
    expect(remaining).toBe(1);
  });
});

// ─── Season promote/move logic ──────────────────────────────────────────

describe('Season reorganization', () => {
  it('promotes a season to a new series', () => {
    const s = createSeries('Freezing');
    const season1 = createSeasonForSeries(s.id, 'Main');
    const season2 = createSeasonForSeries(s.id, 'Zero');

    // "Promote" season2 to its own series
    const newSeries = db.insert(series).values({
      name: 'Freezing Zero',
      nameNormalized: 'freezing zero',
      sortTitle: 'freezing zero',
    }).returning().get();

    db.update(seasons).set({ seriesId: newSeries.id }).where(eq(seasons.id, season2.id)).run();

    // Verify season moved
    const movedSeason = db.select().from(seasons).where(eq(seasons.id, season2.id)).get();
    expect(movedSeason!.seriesId).toBe(newSeries.id);

    // Original series still has season1
    const originalSeasons = db.select().from(seasons).where(eq(seasons.seriesId, s.id)).all();
    expect(originalSeasons).toHaveLength(1);
    expect(originalSeasons[0].id).toBe(season1.id);
  });

  it('moves a season to an existing series', () => {
    const s1 = createSeries('Source');
    const s2 = createSeries('Target');
    const season = createSeasonForSeries(s1.id, 'To Move');
    createSeasonForSeries(s2.id, 'Existing');

    db.update(seasons).set({ seriesId: s2.id }).where(eq(seasons.id, season.id)).run();

    const targetSeasons = db.select().from(seasons).where(eq(seasons.seriesId, s2.id)).all();
    expect(targetSeasons).toHaveLength(2);

    const sourceSeasons = db.select().from(seasons).where(eq(seasons.seriesId, s1.id)).all();
    expect(sourceSeasons).toHaveLength(0);
  });

  it('cleans up empty series after move', () => {
    const s1 = createSeries('Will Be Empty');
    const s2 = createSeries('Destination');
    const season = createSeasonForSeries(s1.id, 'Only Season');
    createSeasonForSeries(s2.id, 'Existing');

    // Move the only season away
    db.update(seasons).set({ seriesId: s2.id }).where(eq(seasons.id, season.id)).run();

    // Check source is now empty
    const remaining = db.select().from(seasons).where(eq(seasons.seriesId, s1.id)).all();
    expect(remaining).toHaveLength(0);

    // Delete the now-empty series
    db.delete(series).where(eq(series.id, s1.id)).run();
    const deleted = db.select().from(series).where(eq(series.id, s1.id)).get();
    expect(deleted).toBeUndefined();
  });
});

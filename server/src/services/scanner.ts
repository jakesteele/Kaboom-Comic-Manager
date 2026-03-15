import { readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { eq, and } from 'drizzle-orm';
import type { Db } from '../db/connection.js';
import { series, seasons, volumes, watchDirectories, scanLog } from '../db/schema/index.js';
import { parseFilename, generateDisplayName } from './parser.js';
import { normalizeName } from '../utils/normalize.js';
import { generateThumbnail } from './thumbnail.js';
import { parseComicInfo } from './cbz.js';
import { getPageCount } from './page-stream.js';
import { checkGroupingSuggestions } from './grouper.js';

const CBZ_REGEX = /\.cbz$/i;

interface DiscoveredFile {
  filePath: string;
  fileName: string;
  fileSize: number;
  parentFolder: string | null; // null if at watch dir root
}

/**
 * Recursively discover all CBZ files in a directory.
 */
async function discoverCbzFiles(dirPath: string, rootPath: string): Promise<DiscoveredFile[]> {
  const files: DiscoveredFile[] = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await discoverCbzFiles(fullPath, rootPath);
        files.push(...subFiles);
      } else if (entry.isFile() && CBZ_REGEX.test(entry.name)) {
        const fileStat = await stat(fullPath);
        const parentFolder = dirPath === rootPath ? null : basename(dirPath);
        files.push({
          filePath: fullPath,
          fileName: entry.name,
          fileSize: fileStat.size,
          parentFolder,
        });
      }
    }
  } catch (err) {
    console.error(`Error scanning directory ${dirPath}:`, err);
  }

  return files;
}

/**
 * Find or create a series by name, returning its ID.
 */
function findOrCreateSeries(db: Db, name: string): number {
  const normalized = normalizeName(name);
  const existing = db.select().from(series).where(eq(series.nameNormalized, normalized)).get();

  if (existing) return existing.id;

  const result = db.insert(series).values({
    name,
    nameNormalized: normalized,
    sortTitle: name.toLowerCase().replace(/^(the|a|an)\s+/i, ''),
  }).returning({ id: series.id }).get();

  return result.id;
}

/**
 * Find or create a season within a series.
 */
function findOrCreateSeason(db: Db, seriesId: number, name: string): number {
  const existing = db.select().from(seasons)
    .where(and(eq(seasons.seriesId, seriesId), eq(seasons.name, name)))
    .get();

  if (existing) return existing.id;

  // Get next sort order
  const maxOrder = db.select({ max: seasons.sortOrder }).from(seasons)
    .where(eq(seasons.seriesId, seriesId)).get();
  const sortOrder = (maxOrder?.max ?? -1) + 1;

  const result = db.insert(seasons).values({
    seriesId,
    name,
    sortOrder,
  }).returning({ id: seasons.id }).get();

  return result.id;
}

/**
 * Process a single CBZ file: parse, find/create series+season, create volume.
 */
async function processFile(db: Db, file: DiscoveredFile): Promise<void> {
  // Check if already in DB
  const existing = db.select().from(volumes).where(eq(volumes.filePath, file.filePath)).get();
  if (existing) return;

  // Parse the filename
  const parsed = parseFilename(file.fileName);

  // If file is inside a folder, also parse the folder name for context
  const folderParsed = file.parentFolder ? parseFilename(file.parentFolder) : null;

  // Determine series name:
  // When inside a subfolder, prefer the folder's series name (user organized files there).
  // Fall back to file-level parse, then raw filename.
  let seriesName: string;
  if (folderParsed?.seriesName) {
    seriesName = folderParsed.seriesName;
  } else {
    seriesName = parsed.seriesName || basename(file.filePath, '.cbz');
  }

  // Determine season name
  // Use explicit season indicators first, then folder subtitle (reliable).
  // Avoid file subtitles as seasons — they may be author names (e.g. "Sun Takeda").
  let seasonName = 'Main';
  if (parsed.seasonIndicator) {
    seasonName = parsed.seasonIndicator;
  } else if (folderParsed?.seasonIndicator) {
    seasonName = folderParsed.seasonIndicator;
  } else if (folderParsed?.subtitle) {
    seasonName = folderParsed.subtitle;
  }

  // Find or create series and season
  const seriesId = findOrCreateSeries(db, seriesName);
  const seasonId = findOrCreateSeason(db, seriesId, seasonName);

  // Get next sort order based on volume number or existing count
  const volCount = db.select({ max: volumes.sortOrder }).from(volumes)
    .where(eq(volumes.seasonId, seasonId)).get();
  const sortOrder = parsed.volumeNumber ?? ((volCount?.max ?? -1) + 1);

  // Insert volume
  const vol = db.insert(volumes).values({
    seasonId,
    filePath: file.filePath,
    fileName: file.fileName,
    displayName: generateDisplayName({
      ...parsed,
      seriesName: seriesName,
      // Only use seasonName as subtitle if it's NOT already the seasonIndicator (avoid duplication)
      subtitle: seasonName !== 'Main' && seasonName !== parsed.seasonIndicator ? seasonName : parsed.subtitle,
    }),
    volumeNumber: parsed.volumeNumber,
    year: parsed.year,
    scanGroup: parsed.scanGroup,
    fileSizeBytes: file.fileSize,
    sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
  }).returning({ id: volumes.id }).get();

  // Extract thumbnail in background (don't block scan)
  generateThumbnail(file.filePath, vol.id).then(thumbPath => {
    if (thumbPath) {
      db.update(volumes).set({ thumbnailPath: thumbPath }).where(eq(volumes.id, vol.id)).run();

      // Also set as series thumbnail if not set
      const s = db.select().from(series).where(eq(series.id, seriesId)).get();
      if (s && !s.thumbnailPath) {
        db.update(series).set({ thumbnailPath: thumbPath }).where(eq(series.id, seriesId)).run();
      }
    }
  }).catch(err => console.error('Thumbnail generation failed:', err));

  // Count pages for OPDS-PSE streaming
  getPageCount(file.filePath).then(count => {
    if (count > 0) {
      db.update(volumes).set({ pageCount: count }).where(eq(volumes.id, vol.id)).run();
    }
  }).catch(err => console.error('Page count failed:', err));

  // Parse ComicInfo.xml in background
  parseComicInfo(file.filePath).then(ci => {
    if (ci) {
      db.update(volumes).set({
        comicInfoParsed: true,
        ciTitle: ci.title ?? null,
        ciSeries: ci.series ?? null,
        ciNumber: ci.number ?? null,
        ciVolume: ci.volume ?? null,
        ciYear: ci.year ?? null,
        ciWriter: ci.writer ?? null,
        ciSummary: ci.summary ?? null,
        ciPageCount: ci.pageCount ?? null,
        ciLanguage: ci.languageISO ?? null,
        ciGenre: ci.genre ?? null,
      }).where(eq(volumes.id, vol.id)).run();
    }
  }).catch(err => console.error('ComicInfo parse failed:', err));
}

/**
 * Scan a single watch directory and process all discovered CBZ files.
 */
export async function scanDirectory(db: Db, watchDirId: number): Promise<void> {
  const watchDir = db.select().from(watchDirectories).where(eq(watchDirectories.id, watchDirId)).get();
  if (!watchDir) throw new Error(`Watch directory ${watchDirId} not found`);

  // Create scan log entry
  const log = db.insert(scanLog).values({
    watchDirId: watchDir.id,
    startedAt: new Date(),
    status: 'running',
  }).returning({ id: scanLog.id }).get();

  try {
    // Discover files
    const files = await discoverCbzFiles(watchDir.path, watchDir.path);

    // Get existing file paths in DB
    const existingVolumes = db.select({ filePath: volumes.filePath }).from(volumes).all();
    const existingPaths = new Set(existingVolumes.map(v => v.filePath));

    let added = 0;
    let removed = 0;

    // Process new files
    for (const file of files) {
      if (!existingPaths.has(file.filePath)) {
        await processFile(db, file);
        added++;
      }
    }

    // Find removed files (files in DB that no longer exist on disk)
    const discoveredPaths = new Set(files.map(f => f.filePath));
    for (const existing of existingVolumes) {
      if (existing.filePath.startsWith(watchDir.path) && !discoveredPaths.has(existing.filePath)) {
        db.delete(volumes).where(eq(volumes.filePath, existing.filePath)).run();
        removed++;
      }
    }

    // Update scan log
    db.update(scanLog).set({
      completedAt: new Date(),
      filesFound: files.length,
      filesAdded: added,
      filesRemoved: removed,
      status: 'completed',
    }).where(eq(scanLog.id, log.id)).run();

    // Update watch directory stats
    db.update(watchDirectories).set({
      lastScanAt: new Date(),
      fileCount: files.length,
    }).where(eq(watchDirectories.id, watchDir.id)).run();

    // Check for grouping suggestions after scan
    checkGroupingSuggestions(db);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    db.update(scanLog).set({
      completedAt: new Date(),
      status: 'failed',
      errorMessage: message,
    }).where(eq(scanLog.id, log.id)).run();
    throw err;
  }
}

/**
 * Scan all enabled watch directories.
 */
export async function scanAll(db: Db): Promise<void> {
  const dirs = db.select().from(watchDirectories).where(eq(watchDirectories.enabled, true)).all();
  for (const dir of dirs) {
    await scanDirectory(db, dir.id);
  }
}

/**
 * Process a single file add event (from file watcher).
 */
export async function handleFileAdded(db: Db, filePath: string, fileSize: number, parentFolder: string | null): Promise<void> {
  await processFile(db, {
    filePath,
    fileName: basename(filePath),
    fileSize,
    parentFolder,
  });
  checkGroupingSuggestions(db);
}

/**
 * Process a single file removal event (from file watcher).
 */
export function handleFileRemoved(db: Db, filePath: string): void {
  db.delete(volumes).where(eq(volumes.filePath, filePath)).run();

  // Clean up empty seasons and series
  const emptySeasons = db.select({ id: seasons.id, seriesId: seasons.seriesId }).from(seasons)
    .leftJoin(volumes, eq(volumes.seasonId, seasons.id))
    .where(eq(volumes.id, null as any))
    .all();

  // This is a simplified cleanup - in practice we'd use a subquery
  // For now, clean up via direct query
}

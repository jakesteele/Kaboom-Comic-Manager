import { watch, type FSWatcher } from 'chokidar';
import { stat } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/connection.js';
import { watchDirectories } from '../db/schema/index.js';
import { handleFileAdded, handleFileRemoved } from './scanner.js';

const CBZ_REGEX = /\.cbz$/i;
const DEBOUNCE_MS = 300;

export class WatcherManager {
  private watchers = new Map<number, FSWatcher>();
  private pendingEvents = new Map<string, { type: 'add' | 'unlink'; watchDirPath: string }>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private db: Db) {}

  /**
   * Initialize watchers for all enabled watch directories in the DB.
   */
  async initializeFromDb(): Promise<void> {
    const dirs = this.db.select().from(watchDirectories).where(eq(watchDirectories.enabled, true)).all();
    for (const dir of dirs) {
      await this.startWatching(dir.id, dir.path);
    }
  }

  /**
   * Start watching a directory for CBZ file changes.
   */
  async startWatching(dirId: number, dirPath: string): Promise<void> {
    if (this.watchers.has(dirId)) {
      await this.stopWatching(dirId);
    }

    const watcher = watch(dirPath, {
      persistent: true,
      ignoreInitial: true,
      depth: 3,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 500,
      },
      ignored: /(^|[/\\])\./,
    });

    watcher.on('add', (filePath: string) => {
      if (CBZ_REGEX.test(filePath)) {
        this.queueEvent(filePath, 'add', dirPath);
      }
    });

    watcher.on('unlink', (filePath: string) => {
      if (CBZ_REGEX.test(filePath)) {
        this.queueEvent(filePath, 'unlink', dirPath);
      }
    });

    watcher.on('error', (err: Error) => {
      console.error(`Watcher error for directory ${dirPath}:`, err);
    });

    this.watchers.set(dirId, watcher);
    console.log(`Started watching: ${dirPath}`);
  }

  /**
   * Stop watching a specific directory.
   */
  async stopWatching(dirId: number): Promise<void> {
    const watcher = this.watchers.get(dirId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(dirId);
    }
  }

  /**
   * Stop all watchers.
   */
  async stopAll(): Promise<void> {
    for (const [id, watcher] of this.watchers) {
      await watcher.close();
    }
    this.watchers.clear();
  }

  /**
   * Queue a file event for debounced processing.
   */
  private queueEvent(filePath: string, type: 'add' | 'unlink', watchDirPath: string): void {
    this.pendingEvents.set(filePath, { type, watchDirPath });

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => this.processPendingEvents(), DEBOUNCE_MS);
  }

  /**
   * Process all queued file events.
   */
  private async processPendingEvents(): Promise<void> {
    const events = new Map(this.pendingEvents);
    this.pendingEvents.clear();

    for (const [filePath, event] of events) {
      try {
        if (event.type === 'add') {
          const fileStat = await stat(filePath);
          const parentDir = dirname(filePath);
          const parentFolder = parentDir === event.watchDirPath ? null : basename(parentDir);
          await handleFileAdded(this.db, filePath, fileStat.size, parentFolder);
          console.log(`Added: ${filePath}`);
        } else {
          handleFileRemoved(this.db, filePath);
          console.log(`Removed: ${filePath}`);
        }
      } catch (err) {
        console.error(`Error processing ${event.type} event for ${filePath}:`, err);
      }
    }
  }
}

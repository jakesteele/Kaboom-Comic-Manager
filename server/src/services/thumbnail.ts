import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.js';
import { extractCoverImage } from './cbz.js';
import { extractEpubCover } from './epub.js';

/**
 * Extract cover image buffer from a file, dispatching by format.
 */
async function extractCover(filePath: string): Promise<Buffer | null> {
  if (/\.epub$/i.test(filePath)) {
    return extractEpubCover(filePath);
  }
  return extractCoverImage(filePath);
}

/**
 * Extract and cache a thumbnail from a CBZ or ePub file.
 * Returns the path to the cached thumbnail, or null on failure.
 */
export async function generateThumbnail(
  filePath: string,
  volumeId: number,
  width = 300,
  quality = 80
): Promise<string | null> {
  try {
    mkdirSync(config.thumbnailDir, { recursive: true });

    const thumbPath = join(config.thumbnailDir, `${volumeId}.jpg`);

    // Skip if already cached
    if (existsSync(thumbPath)) {
      return thumbPath;
    }

    const imageBuffer = await extractCover(filePath);
    if (!imageBuffer) return null;

    await sharp(imageBuffer)
      .resize(width, undefined, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality })
      .toFile(thumbPath);

    return thumbPath;
  } catch (err) {
    console.error(`Failed to generate thumbnail for ${filePath}:`, err);
    return null;
  }
}

/**
 * Generate a full-size cover from a CBZ file.
 */
export async function generateCover(
  filePath: string,
  volumeId: number,
  width = 800,
  quality = 85
): Promise<string | null> {
  try {
    mkdirSync(config.thumbnailDir, { recursive: true });

    const coverPath = join(config.thumbnailDir, `${volumeId}_full.jpg`);

    if (existsSync(coverPath)) {
      return coverPath;
    }

    const imageBuffer = await extractCover(filePath);
    if (!imageBuffer) return null;

    await sharp(imageBuffer)
      .resize(width, undefined, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality })
      .toFile(coverPath);

    return coverPath;
  } catch (err) {
    console.error(`Failed to generate cover for ${filePath}:`, err);
    return null;
  }
}

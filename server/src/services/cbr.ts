import { readFileSync } from 'node:fs';
import { createExtractorFromData } from 'node-unrar-js';
import { XMLParser } from 'fast-xml-parser';
import type { ComicInfo } from './cbz.js';

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif)$/i;
const COMIC_INFO_REGEX = /^comicinfo\.xml$/i;

/**
 * Get sorted image entries from a RAR/CBR archive.
 * Returns entry names sorted alphabetically (first = cover).
 */
async function listImageEntries(filePath: string): Promise<string[]> {
  const buf = readFileSync(filePath);
  const extractor = await createExtractorFromData({ data: buf.buffer as ArrayBuffer });
  const list = extractor.getFileList();

  const names: string[] = [];
  for (const header of list.fileHeaders) {
    if (!header.flags.directory && IMAGE_EXTENSIONS.test(header.name)) {
      names.push(header.name);
    }
  }

  return names.sort((a, b) => a.localeCompare(b));
}

/**
 * Extract a specific entry from a RAR archive and return its data as a Buffer.
 */
async function extractEntry(filePath: string, entryName: string): Promise<Buffer | null> {
  const buf = readFileSync(filePath);
  const extractor = await createExtractorFromData({ data: buf.buffer as ArrayBuffer });
  const extracted = extractor.extract({ files: [entryName] });

  for (const file of extracted.files) {
    if (file.extraction) {
      return Buffer.from(file.extraction);
    }
  }

  return null;
}

/**
 * Extract the first image from a CBR file (for use as cover).
 * Returns the image buffer or null if no images found.
 */
export async function extractCbrCoverImage(filePath: string): Promise<Buffer | null> {
  const images = await listImageEntries(filePath);
  if (images.length === 0) return null;
  return extractEntry(filePath, images[0]);
}

/**
 * Parse ComicInfo.xml from inside a CBR file if present.
 */
export async function parseCbrComicInfo(filePath: string): Promise<ComicInfo | null> {
  const buf = readFileSync(filePath);
  const extractor = await createExtractorFromData({ data: buf.buffer as ArrayBuffer });
  const list = extractor.getFileList();

  let comicInfoName: string | null = null;
  for (const header of list.fileHeaders) {
    if (COMIC_INFO_REGEX.test(header.name)) {
      comicInfoName = header.name;
      break;
    }
  }

  if (!comicInfoName) return null;

  // Need a fresh extractor since the iterator was consumed
  const extractor2 = await createExtractorFromData({ data: buf.buffer as ArrayBuffer });
  const extracted = extractor2.extract({ files: [comicInfoName] });

  for (const file of extracted.files) {
    if (file.extraction) {
      try {
        const xmlStr = Buffer.from(file.extraction).toString('utf-8');
        const parser = new XMLParser({ ignoreAttributes: true });
        const parsed = parser.parse(xmlStr);
        const ci = parsed.ComicInfo || parsed.comicinfo || {};
        return {
          title: ci.Title || ci.title,
          series: ci.Series || ci.series,
          number: ci.Number != null ? String(ci.Number) : ci.number != null ? String(ci.number) : undefined,
          volume: ci.Volume != null ? Number(ci.Volume) : ci.volume != null ? Number(ci.volume) : undefined,
          year: ci.Year != null ? Number(ci.Year) : ci.year != null ? Number(ci.year) : undefined,
          writer: ci.Writer || ci.writer,
          summary: ci.Summary || ci.summary,
          pageCount: ci.PageCount != null ? Number(ci.PageCount) : ci.pageCount != null ? Number(ci.pageCount) : undefined,
          languageISO: ci.LanguageISO || ci.languageISO,
          genre: ci.Genre || ci.genre,
        };
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Get total page (image) count in a CBR file.
 */
export async function getCbrPageCount(filePath: string): Promise<number> {
  const images = await listImageEntries(filePath);
  return images.length;
}

/**
 * Extract a single page image from a CBR file by page index (0-based).
 * Returns the image buffer or null if page not found.
 */
export async function extractCbrPage(
  filePath: string,
  pageNumber: number,
): Promise<Buffer | null> {
  const images = await listImageEntries(filePath);
  if (pageNumber < 0 || pageNumber >= images.length) return null;
  return extractEntry(filePath, images[pageNumber]);
}

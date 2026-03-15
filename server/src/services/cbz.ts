import yauzl from 'yauzl';
import { XMLParser } from 'fast-xml-parser';
import { Readable } from 'node:stream';

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif)$/i;
const COMIC_INFO_REGEX = /^comicinfo\.xml$/i;

export interface ComicInfo {
  title?: string;
  series?: string;
  number?: string;
  volume?: number;
  year?: number;
  writer?: string;
  summary?: string;
  pageCount?: number;
  languageISO?: string;
  genre?: string;
}

interface CbzEntry {
  fileName: string;
  offset: number;
  compressedSize: number;
  uncompressedSize: number;
}

/**
 * Open a CBZ file and return a yauzl ZipFile handle.
 */
function openZip(filePath: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
      if (err) reject(err);
      else resolve(zipfile!);
    });
  });
}

/**
 * Read all entries from a zip file.
 */
function readEntries(zipfile: yauzl.ZipFile): Promise<yauzl.Entry[]> {
  return new Promise((resolve, reject) => {
    const entries: yauzl.Entry[] = [];
    zipfile.on('entry', (entry: yauzl.Entry) => {
      entries.push(entry);
      zipfile.readEntry();
    });
    zipfile.on('end', () => resolve(entries));
    zipfile.on('error', reject);
    zipfile.readEntry();
  });
}

/**
 * Read a specific entry's data as a buffer.
 */
function readEntryData(zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err) return reject(err);
      const chunks: Buffer[] = [];
      stream!.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream!.on('end', () => resolve(Buffer.concat(chunks)));
      stream!.on('error', reject);
    });
  });
}

/**
 * Extract the first image from a CBZ file (for use as cover).
 * Returns the image buffer or null if no images found.
 */
export async function extractCoverImage(filePath: string): Promise<Buffer | null> {
  const zipfile = await openZip(filePath);
  const entries = await readEntries(zipfile);

  // Find image entries, sort alphabetically (first image = cover)
  const imageEntries = entries
    .filter(e => !e.fileName.endsWith('/') && IMAGE_EXTENSIONS.test(e.fileName))
    .sort((a, b) => a.fileName.localeCompare(b.fileName));

  if (imageEntries.length === 0) {
    zipfile.close();
    return null;
  }

  // Re-open to read the specific entry (yauzl is forward-only)
  const zipfile2 = await openZip(filePath);
  return new Promise((resolve, reject) => {
    zipfile2.on('entry', (entry: yauzl.Entry) => {
      if (entry.fileName === imageEntries[0].fileName) {
        readEntryData(zipfile2, entry).then(data => {
          zipfile2.close();
          resolve(data);
        }).catch(reject);
      } else {
        zipfile2.readEntry();
      }
    });
    zipfile2.on('end', () => resolve(null));
    zipfile2.on('error', reject);
    zipfile2.readEntry();
  });
}

/**
 * Parse ComicInfo.xml from inside a CBZ file if present.
 */
export async function parseComicInfo(filePath: string): Promise<ComicInfo | null> {
  const zipfile = await openZip(filePath);
  const entries = await readEntries(zipfile);

  const comicInfoEntry = entries.find(e => COMIC_INFO_REGEX.test(e.fileName));
  if (!comicInfoEntry) {
    zipfile.close();
    return null;
  }

  // Re-open for reading
  const zipfile2 = await openZip(filePath);
  return new Promise((resolve, reject) => {
    zipfile2.on('entry', (entry: yauzl.Entry) => {
      if (COMIC_INFO_REGEX.test(entry.fileName)) {
        readEntryData(zipfile2, entry).then(data => {
          zipfile2.close();
          try {
            const parser = new XMLParser({ ignoreAttributes: true });
            const parsed = parser.parse(data.toString('utf-8'));
            const ci = parsed.ComicInfo || parsed.comicinfo || {};
            resolve({
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
            });
          } catch {
            resolve(null);
          }
        }).catch(reject);
      } else {
        zipfile2.readEntry();
      }
    });
    zipfile2.on('end', () => resolve(null));
    zipfile2.on('error', reject);
    zipfile2.readEntry();
  });
}

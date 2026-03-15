import yauzl from 'yauzl';
import sharp from 'sharp';

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif)$/i;

export interface PageInfo {
  index: number;
  fileName: string;
}

/**
 * List all image pages in a CBZ file, sorted alphabetically.
 * Returns page entries with their index (0-based).
 */
export async function listPages(filePath: string): Promise<PageInfo[]> {
  const zipfile = await openZip(filePath);
  const entries = await readAllEntries(zipfile);
  zipfile.close();

  return entries
    .filter(e => !e.fileName.endsWith('/') && IMAGE_EXTENSIONS.test(e.fileName))
    .sort((a, b) => a.fileName.localeCompare(b.fileName))
    .map((e, i) => ({ index: i, fileName: e.fileName }));
}

/**
 * Get the total page count for a CBZ file.
 */
export async function getPageCount(filePath: string): Promise<number> {
  const pages = await listPages(filePath);
  return pages.length;
}

/**
 * Extract a single page image from a CBZ file by page index (0-based).
 * Optionally resize to maxWidth.
 * Returns the image buffer as JPEG.
 */
export async function extractPage(
  filePath: string,
  pageNumber: number,
  maxWidth?: number
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const pages = await listPages(filePath);
  if (pageNumber < 0 || pageNumber >= pages.length) return null;

  const targetFileName = pages[pageNumber].fileName;

  const zipfile = await openZip(filePath);
  const imageBuffer = await readSpecificEntry(zipfile, targetFileName);
  zipfile.close();

  if (!imageBuffer) return null;

  // Convert to JPEG and optionally resize
  let pipeline = sharp(imageBuffer);

  if (maxWidth && maxWidth > 0) {
    pipeline = pipeline.resize(maxWidth, undefined, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const output = await pipeline.jpeg({ quality: 90 }).toBuffer();
  return { buffer: output, contentType: 'image/jpeg' };
}

// ── Internal helpers ────────────────────────────────────────────

function openZip(filePath: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
      if (err) reject(err);
      else resolve(zipfile!);
    });
  });
}

function readAllEntries(zipfile: yauzl.ZipFile): Promise<yauzl.Entry[]> {
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

function readSpecificEntry(zipfile: yauzl.ZipFile, targetFileName: string): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    zipfile.on('entry', (entry: yauzl.Entry) => {
      if (entry.fileName === targetFileName) {
        zipfile.openReadStream(entry, (err, stream) => {
          if (err) return reject(err);
          const chunks: Buffer[] = [];
          stream!.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream!.on('end', () => resolve(Buffer.concat(chunks)));
          stream!.on('error', reject);
        });
      } else {
        zipfile.readEntry();
      }
    });
    zipfile.on('end', () => resolve(null));
    zipfile.on('error', reject);
    zipfile.readEntry();
  });
}

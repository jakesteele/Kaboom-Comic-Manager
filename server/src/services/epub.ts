import yauzl from 'yauzl';
import { XMLParser } from 'fast-xml-parser';
import type { ComicInfo } from './cbz.js';

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif|svg)$/i;

// ---------------------------------------------------------------------------
// ZIP helpers (shared with cbz.ts but duplicated to keep modules independent)
// ---------------------------------------------------------------------------

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

function readEntryByName(zipfile: yauzl.ZipFile, targetFileName: string): Promise<Buffer | null> {
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

// ---------------------------------------------------------------------------
// ePub OPF parsing
// ---------------------------------------------------------------------------

interface OpfData {
  coverImageHref: string | null;
  metadata: EpubMetadata;
}

interface EpubMetadata {
  title?: string;
  creator?: string;
  language?: string;
  date?: string;
  description?: string;
  subject?: string;
  publisher?: string;
}

/**
 * Find the OPF file path by reading META-INF/container.xml.
 */
function findOpfPath(containerXml: string): string | null {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  try {
    const parsed = parser.parse(containerXml);
    const rootfiles = parsed?.container?.rootfiles?.rootfile;
    if (Array.isArray(rootfiles)) {
      return rootfiles[0]?.['@_full-path'] ?? null;
    }
    return rootfiles?.['@_full-path'] ?? null;
  } catch {
    return null;
  }
}

/**
 * Parse the OPF file to extract cover image href and metadata.
 */
function parseOpf(opfXml: string, opfDir: string): OpfData {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const parsed = parser.parse(opfXml);
  const pkg = parsed?.package ?? parsed?.['opf:package'] ?? {};
  const metadata = pkg?.metadata ?? {};
  const manifest = pkg?.manifest ?? {};
  const guide = pkg?.guide ?? {};

  // Extract metadata
  const epubMeta: EpubMetadata = {};
  epubMeta.title = extractText(metadata['dc:title']);
  epubMeta.creator = extractText(metadata['dc:creator']);
  epubMeta.language = extractText(metadata['dc:language']);
  epubMeta.date = extractText(metadata['dc:date']);
  epubMeta.description = extractText(metadata['dc:description']);
  epubMeta.subject = extractText(metadata['dc:subject']);
  epubMeta.publisher = extractText(metadata['dc:publisher']);

  // Find cover image through multiple strategies
  let coverImageHref: string | null = null;

  // Strategy 1: <meta name="cover" content="item-id" /> → find item in manifest
  const metaEntries = ensureArray(metadata?.meta);
  const coverMeta = metaEntries.find(
    (m: any) => m?.['@_name'] === 'cover'
  );
  if (coverMeta) {
    const coverId = coverMeta['@_content'];
    const items = ensureArray(manifest?.item);
    const coverItem = items.find((i: any) => i?.['@_id'] === coverId);
    if (coverItem?.['@_href']) {
      coverImageHref = resolveHref(coverItem['@_href'], opfDir);
    }
  }

  // Strategy 2: manifest item with properties="cover-image"
  if (!coverImageHref) {
    const items = ensureArray(manifest?.item);
    const coverItem = items.find(
      (i: any) => i?.['@_properties']?.includes('cover-image')
    );
    if (coverItem?.['@_href']) {
      coverImageHref = resolveHref(coverItem['@_href'], opfDir);
    }
  }

  // Strategy 3: guide reference type="cover"
  if (!coverImageHref) {
    const refs = ensureArray(guide?.reference);
    const coverRef = refs.find((r: any) => r?.['@_type'] === 'cover');
    if (coverRef?.['@_href'] && IMAGE_EXTENSIONS.test(coverRef['@_href'])) {
      coverImageHref = resolveHref(coverRef['@_href'], opfDir);
    }
  }

  // Strategy 4: Look for any manifest item with "cover" in id/href and is an image
  if (!coverImageHref) {
    const items = ensureArray(manifest?.item);
    const coverItem = items.find(
      (i: any) =>
        (i?.['@_id']?.toLowerCase()?.includes('cover') ||
         i?.['@_href']?.toLowerCase()?.includes('cover')) &&
        i?.['@_media-type']?.startsWith('image/')
    );
    if (coverItem?.['@_href']) {
      coverImageHref = resolveHref(coverItem['@_href'], opfDir);
    }
  }

  return { coverImageHref, metadata: epubMeta };
}

function extractText(val: any): string | undefined {
  if (val == null) return undefined;
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && '#text' in val) return String(val['#text']);
  if (Array.isArray(val)) return extractText(val[0]);
  return String(val);
}

function ensureArray(val: any): any[] {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

function resolveHref(href: string, opfDir: string): string {
  if (href.startsWith('/')) return href.slice(1);
  if (!opfDir || opfDir === '.') return href;
  return `${opfDir}/${href}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract the cover image from an ePub file.
 * Returns the image buffer or null if no cover found.
 */
export async function extractEpubCover(filePath: string): Promise<Buffer | null> {
  try {
    // Step 1: Read container.xml to find OPF path
    let zipfile = await openZip(filePath);
    const containerBuf = await readEntryByName(zipfile, 'META-INF/container.xml');
    if (!containerBuf) return null;

    const opfPath = findOpfPath(containerBuf.toString('utf-8'));
    if (!opfPath) return null;

    // Step 2: Read OPF to find cover image path
    zipfile = await openZip(filePath);
    const opfBuf = await readEntryByName(zipfile, opfPath);
    if (!opfBuf) return null;

    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/')) : '';
    const { coverImageHref } = parseOpf(opfBuf.toString('utf-8'), opfDir);
    if (!coverImageHref) return null;

    // Step 3: Extract the cover image
    zipfile = await openZip(filePath);
    const imageBuf = await readEntryByName(zipfile, coverImageHref);

    // If exact path didn't work, try case-insensitive search
    if (!imageBuf) {
      zipfile = await openZip(filePath);
      const entries = await readAllEntries(zipfile);
      const lowerTarget = coverImageHref.toLowerCase();
      const match = entries.find(e => e.fileName.toLowerCase() === lowerTarget);
      if (match) {
        zipfile = await openZip(filePath);
        return await readEntryByName(zipfile, match.fileName);
      }
      return null;
    }

    return imageBuf;
  } catch (err) {
    console.error(`Failed to extract ePub cover from ${filePath}:`, err);
    return null;
  }
}

/**
 * Parse ePub metadata (OPF) and return it in ComicInfo-compatible format.
 */
export async function parseEpubMetadata(filePath: string): Promise<ComicInfo | null> {
  try {
    // Read container.xml
    let zipfile = await openZip(filePath);
    const containerBuf = await readEntryByName(zipfile, 'META-INF/container.xml');
    if (!containerBuf) return null;

    const opfPath = findOpfPath(containerBuf.toString('utf-8'));
    if (!opfPath) return null;

    // Read OPF
    zipfile = await openZip(filePath);
    const opfBuf = await readEntryByName(zipfile, opfPath);
    if (!opfBuf) return null;

    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/')) : '';
    const { metadata } = parseOpf(opfBuf.toString('utf-8'), opfDir);

    const year = metadata.date ? parseInt(metadata.date.substring(0, 4), 10) : undefined;

    return {
      title: metadata.title,
      writer: metadata.creator,
      languageISO: metadata.language,
      year: year && !isNaN(year) ? year : undefined,
      summary: metadata.description,
      genre: metadata.subject,
    };
  } catch (err) {
    console.error(`Failed to parse ePub metadata from ${filePath}:`, err);
    return null;
  }
}

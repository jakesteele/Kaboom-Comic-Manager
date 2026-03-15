import { create } from 'xmlbuilder2';
import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces.js';
import {
  ATOM_NS,
  OPDS_NS,
  DC_NS,
  OPENSEARCH_NS,
  PSE_NS,
  NAVIGATION_TYPE,
  ACQUISITION_TYPE,
  CBZ_TYPE,
  OPENSEARCH_TYPE,
  REL_SELF,
  REL_START,
  REL_SEARCH,
  REL_NEXT,
  REL_PREVIOUS,
  REL_ACQUISITION,
  REL_IMAGE,
  REL_THUMBNAIL,
  REL_PSE_STREAM,
} from '@opds/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeedDocumentOpts {
  id: string;
  title: string;
  baseUrl: string;
  selfHref: string;
  feedType: typeof NAVIGATION_TYPE | typeof ACQUISITION_TYPE;
}

export interface NavigationEntryOpts {
  id: string;
  title: string;
  href: string;
  type: string;
  content?: string;
  thumbnailHref?: string;
  updated: string; // ISO-8601
}

export interface AcquisitionEntryOpts {
  id: string;
  title: string;
  href: string;
  type: string;
  thumbnailHref?: string;
  coverHref?: string;
  downloadHref: string;
  summary?: string;
  author?: string;
  language?: string;
  updated: string; // ISO-8601
  fileName: string;
  // OPDS-PSE fields
  pageCount?: number;
  streamHref?: string; // URL template with {pageNumber} and {maxWidth}
}

export interface PaginationOpts {
  baseUrl: string;
  currentPage: number;
  totalPages: number;
  feedType: string;
}

// ---------------------------------------------------------------------------
// Feed document creation
// ---------------------------------------------------------------------------

/**
 * Create a new Atom/OPDS feed document with the standard root element,
 * namespaces, metadata, and self / start / search links.
 */
export function createFeedDocument(opts: FeedDocumentOpts): XMLBuilder {
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele(ATOM_NS, 'feed')
      .att('xmlns', ATOM_NS)
      .att('xmlns:opds', OPDS_NS)
      .att('xmlns:dc', DC_NS)
      .att('xmlns:opensearch', OPENSEARCH_NS)
      .att('xmlns:pse', PSE_NS);

  doc.ele(ATOM_NS, 'id').txt(opts.id);
  doc.ele(ATOM_NS, 'title').txt(opts.title);
  doc.ele(ATOM_NS, 'updated').txt(new Date().toISOString());
  doc.ele(ATOM_NS, 'author')
    .ele(ATOM_NS, 'name').txt('Kaboom').up();

  // Self link
  doc.ele(ATOM_NS, 'link')
    .att('rel', REL_SELF)
    .att('href', opts.selfHref)
    .att('type', opts.feedType);

  // Start (root catalog) link
  doc.ele(ATOM_NS, 'link')
    .att('rel', REL_START)
    .att('href', `${opts.baseUrl}/opds`)
    .att('type', NAVIGATION_TYPE);

  // Search link
  doc.ele(ATOM_NS, 'link')
    .att('rel', REL_SEARCH)
    .att('href', `${opts.baseUrl}/opds/search.xml`)
    .att('type', OPENSEARCH_TYPE);

  return doc;
}

// ---------------------------------------------------------------------------
// Navigation entry
// ---------------------------------------------------------------------------

/**
 * Append a navigation entry to an existing feed document.
 * Navigation entries link to other feeds (subsections).
 */
export function addNavigationEntry(doc: XMLBuilder, opts: NavigationEntryOpts): void {
  const entry = doc.ele(ATOM_NS, 'entry');

  entry.ele(ATOM_NS, 'id').txt(opts.id);
  entry.ele(ATOM_NS, 'title').txt(opts.title);
  entry.ele(ATOM_NS, 'updated').txt(opts.updated);

  entry.ele(ATOM_NS, 'link')
    .att('rel', 'subsection')
    .att('href', opts.href)
    .att('type', opts.type);

  if (opts.content) {
    entry.ele(ATOM_NS, 'content')
      .att('type', 'text')
      .txt(opts.content);
  }

  if (opts.thumbnailHref) {
    entry.ele(ATOM_NS, 'link')
      .att('rel', REL_THUMBNAIL)
      .att('href', opts.thumbnailHref)
      .att('type', 'image/jpeg');
  }
}

// ---------------------------------------------------------------------------
// Acquisition entry
// ---------------------------------------------------------------------------

/**
 * Append an acquisition entry to an existing feed document.
 * Acquisition entries represent downloadable content (CBZ files).
 */
export function addAcquisitionEntry(doc: XMLBuilder, opts: AcquisitionEntryOpts): void {
  const entry = doc.ele(ATOM_NS, 'entry');

  entry.ele(ATOM_NS, 'id').txt(opts.id);
  entry.ele(ATOM_NS, 'title').txt(opts.title);
  entry.ele(ATOM_NS, 'updated').txt(opts.updated);

  // Acquisition link (download)
  entry.ele(ATOM_NS, 'link')
    .att('rel', REL_ACQUISITION)
    .att('href', opts.downloadHref)
    .att('type', CBZ_TYPE)
    .att('title', opts.fileName);

  // Thumbnail
  if (opts.thumbnailHref) {
    entry.ele(ATOM_NS, 'link')
      .att('rel', REL_THUMBNAIL)
      .att('href', opts.thumbnailHref)
      .att('type', 'image/jpeg');
  }

  // Full-size cover
  if (opts.coverHref) {
    entry.ele(ATOM_NS, 'link')
      .att('rel', REL_IMAGE)
      .att('href', opts.coverHref)
      .att('type', 'image/jpeg');
  }

  // Summary
  if (opts.summary) {
    entry.ele(ATOM_NS, 'content')
      .att('type', 'text')
      .txt(opts.summary);
  }

  // Author
  if (opts.author) {
    entry.ele(ATOM_NS, 'author')
      .ele(ATOM_NS, 'name').txt(opts.author).up();
  }

  // Language (Dublin Core)
  if (opts.language) {
    entry.ele(DC_NS, 'dc:language').txt(opts.language);
  }

  // OPDS-PSE streaming link
  if (opts.streamHref && opts.pageCount != null && opts.pageCount > 0) {
    entry.ele(ATOM_NS, 'link')
      .att('rel', REL_PSE_STREAM)
      .att('type', 'image/jpeg')
      .att('href', opts.streamHref)
      .att('pse:count', String(opts.pageCount));
  }
}

// ---------------------------------------------------------------------------
// Pagination links
// ---------------------------------------------------------------------------

/**
 * Add next / previous pagination links and opensearch totalResults
 * metadata to a feed document.
 */
export function addPaginationLinks(doc: XMLBuilder, opts: PaginationOpts): void {
  // Strip existing page param from the base URL so we can rebuild it cleanly
  const base = opts.baseUrl.replace(/[?&]page=\d+/g, '');
  const sep = base.includes('?') ? '&' : '?';

  if (opts.currentPage > 1) {
    doc.ele(ATOM_NS, 'link')
      .att('rel', REL_PREVIOUS)
      .att('href', `${base}${sep}page=${opts.currentPage - 1}`)
      .att('type', opts.feedType);
  }

  if (opts.currentPage < opts.totalPages) {
    doc.ele(ATOM_NS, 'link')
      .att('rel', REL_NEXT)
      .att('href', `${base}${sep}page=${opts.currentPage + 1}`)
      .att('type', opts.feedType);
  }
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

/**
 * Serialize an xmlbuilder2 document to an XML string with the XML declaration.
 */
export function serializeToXml(doc: XMLBuilder): string {
  return doc.end({ prettyPrint: true });
}

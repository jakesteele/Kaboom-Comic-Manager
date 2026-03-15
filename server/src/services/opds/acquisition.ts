import {
  ACQUISITION_TYPE,
} from '@opds/shared';
import {
  createFeedDocument,
  addAcquisitionEntry,
  addPaginationLinks,
  serializeToXml,
} from './feed-builder.js';
import type { Volume, Season } from '@opds/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Volume row into the opts expected by addAcquisitionEntry.
 */
function volumeToEntryOpts(baseUrl: string, vol: Volume & { pageCount?: number }) {
  const updated = (vol.updatedAt instanceof Date ? vol.updatedAt : new Date(vol.updatedAt)).toISOString();

  const thumbnailHref = vol.thumbnailPath
    ? `${baseUrl}/opds/thumbnail/${vol.id}`
    : undefined;

  const coverHref = vol.thumbnailPath
    ? `${baseUrl}/opds/cover/${vol.id}`
    : undefined;

  // OPDS-PSE streaming URL template
  const pageCount = vol.pageCount ?? vol.ciPageCount ?? undefined;
  const streamHref = pageCount && pageCount > 0
    ? `${baseUrl}/opds/stream/${vol.id}?page={pageNumber}&width={maxWidth}`
    : undefined;

  return {
    id: `urn:opds:volume:${vol.id}`,
    title: vol.displayName,
    href: `${baseUrl}/opds/download/${vol.id}`,
    type: ACQUISITION_TYPE,
    thumbnailHref,
    coverHref,
    downloadHref: `${baseUrl}/opds/download/${vol.id}`,
    summary: vol.ciSummary ?? undefined,
    author: vol.ciWriter ?? undefined,
    language: vol.ciLanguage ?? undefined,
    updated,
    fileName: vol.fileName,
    pageCount,
    streamHref,
  };
}

// ---------------------------------------------------------------------------
// Season feed – volumes in a season
// ---------------------------------------------------------------------------

/**
 * Build an acquisition feed for a single season, listing its volumes.
 */
export function buildSeasonFeed(
  baseUrl: string,
  seasonData: Season,
  volumesList: Volume[],
  seriesName: string,
): string {
  const doc = createFeedDocument({
    id: `${baseUrl}/opds/season/${seasonData.id}`,
    title: `${seriesName} - ${seasonData.name}`,
    baseUrl,
    selfHref: `${baseUrl}/opds/season/${seasonData.id}`,
    feedType: ACQUISITION_TYPE,
  });

  for (const vol of volumesList) {
    addAcquisitionEntry(doc, volumeToEntryOpts(baseUrl, vol));
  }

  return serializeToXml(doc);
}

// ---------------------------------------------------------------------------
// All volumes (paginated)
// ---------------------------------------------------------------------------

/**
 * Build a paginated acquisition feed of every volume in the library.
 */
export function buildAllVolumesFeed(
  baseUrl: string,
  volumesList: Volume[],
  page: number,
  totalPages: number,
): string {
  const selfHref = page > 1
    ? `${baseUrl}/opds/all?page=${page}`
    : `${baseUrl}/opds/all`;

  const doc = createFeedDocument({
    id: `${baseUrl}/opds/all`,
    title: 'All Volumes',
    baseUrl,
    selfHref,
    feedType: ACQUISITION_TYPE,
  });

  if (totalPages > 1) {
    addPaginationLinks(doc, {
      baseUrl: `${baseUrl}/opds/all`,
      currentPage: page,
      totalPages,
      feedType: ACQUISITION_TYPE,
    });
  }

  for (const vol of volumesList) {
    addAcquisitionEntry(doc, volumeToEntryOpts(baseUrl, vol));
  }

  return serializeToXml(doc);
}

// ---------------------------------------------------------------------------
// New volumes (recently added)
// ---------------------------------------------------------------------------

/**
 * Build an acquisition feed of the most recently added volumes.
 * The caller is responsible for sorting/limiting the list before passing it.
 */
export function buildNewVolumesFeed(
  baseUrl: string,
  volumesList: Volume[],
): string {
  const doc = createFeedDocument({
    id: `${baseUrl}/opds/new`,
    title: 'Recently Added',
    baseUrl,
    selfHref: `${baseUrl}/opds/new`,
    feedType: ACQUISITION_TYPE,
  });

  for (const vol of volumesList) {
    addAcquisitionEntry(doc, volumeToEntryOpts(baseUrl, vol));
  }

  return serializeToXml(doc);
}

// ---------------------------------------------------------------------------
// Search results
// ---------------------------------------------------------------------------

/**
 * Build an acquisition feed containing search results for the given query.
 */
export function buildSearchResultsFeed(
  baseUrl: string,
  volumesList: Volume[],
  query: string,
): string {
  const doc = createFeedDocument({
    id: `${baseUrl}/opds/search?q=${encodeURIComponent(query)}`,
    title: `Search results for "${query}"`,
    baseUrl,
    selfHref: `${baseUrl}/opds/search?q=${encodeURIComponent(query)}`,
    feedType: ACQUISITION_TYPE,
  });

  for (const vol of volumesList) {
    addAcquisitionEntry(doc, volumeToEntryOpts(baseUrl, vol));
  }

  return serializeToXml(doc);
}

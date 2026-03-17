import {
  NAVIGATION_TYPE,
  ACQUISITION_TYPE,
} from '@opds/shared';
import {
  createFeedDocument,
  addNavigationEntry,
  addPaginationLinks,
  serializeToXml,
} from './feed-builder.js';
import type { Series, Season } from '@opds/shared';

// ---------------------------------------------------------------------------
// Root catalog
// ---------------------------------------------------------------------------

/**
 * Build the root OPDS navigation catalog.
 * Provides top-level links to browse series, view newest additions, and
 * browse all volumes.
 */
export function buildRootCatalog(baseUrl: string, hasTags = false): string {
  const now = new Date().toISOString();
  const doc = createFeedDocument({
    id: `${baseUrl}/opds`,
    title: 'Kaboom Catalog',
    baseUrl,
    selfHref: `${baseUrl}/opds`,
    feedType: NAVIGATION_TYPE,
  });

  addNavigationEntry(doc, {
    id: `${baseUrl}/opds/series`,
    title: 'All Series',
    href: `${baseUrl}/opds/series`,
    type: NAVIGATION_TYPE,
    content: 'Browse comic series alphabetically',
    updated: now,
  });

  if (hasTags) {
    addNavigationEntry(doc, {
      id: `${baseUrl}/opds/tags`,
      title: 'By Tags',
      href: `${baseUrl}/opds/tags`,
      type: NAVIGATION_TYPE,
      content: 'Browse series by tag',
      updated: now,
    });
  }

  addNavigationEntry(doc, {
    id: `${baseUrl}/opds/new`,
    title: 'Recently Added',
    href: `${baseUrl}/opds/new`,
    type: ACQUISITION_TYPE,
    content: 'Recently added volumes',
    updated: now,
  });

  addNavigationEntry(doc, {
    id: `${baseUrl}/opds/all`,
    title: 'All Volumes',
    href: `${baseUrl}/opds/all`,
    type: ACQUISITION_TYPE,
    content: 'Every volume in the library',
    updated: now,
  });

  return serializeToXml(doc);
}

// ---------------------------------------------------------------------------
// Series list (paginated)
// ---------------------------------------------------------------------------

/**
 * Build a navigation feed listing all series with pagination.
 * Each entry links to the series detail feed showing its seasons.
 */
export function buildSeriesListFeed(
  baseUrl: string,
  seriesList: Series[],
  page: number,
  totalPages: number,
): string {
  const selfHref = page > 1
    ? `${baseUrl}/opds/series?page=${page}`
    : `${baseUrl}/opds/series`;

  const doc = createFeedDocument({
    id: `${baseUrl}/opds/series`,
    title: 'All Series',
    baseUrl,
    selfHref,
    feedType: NAVIGATION_TYPE,
  });

  if (totalPages > 1) {
    addPaginationLinks(doc, {
      baseUrl: `${baseUrl}/opds/series`,
      currentPage: page,
      totalPages,
      feedType: NAVIGATION_TYPE,
    });
  }

  for (const s of seriesList) {
    const updated = (s.updatedAt instanceof Date ? s.updatedAt : new Date(s.updatedAt)).toISOString();
    const thumbnailHref = s.thumbnailPath
      ? `${baseUrl}/opds/thumbnail/series/${s.id}`
      : undefined;

    addNavigationEntry(doc, {
      id: `${baseUrl}/opds/series/${s.id}`,
      title: s.name,
      href: `${baseUrl}/opds/series/${s.id}`,
      type: NAVIGATION_TYPE,
      content: s.volumeCount != null ? `${s.volumeCount} volume${s.volumeCount === 1 ? '' : 's'}` : undefined,
      thumbnailHref,
      updated,
    });
  }

  return serializeToXml(doc);
}

// ---------------------------------------------------------------------------
// Series detail – seasons within a series
// ---------------------------------------------------------------------------

/**
 * Build a navigation feed for a single series showing its seasons.
 * Each season entry links to an acquisition feed of volumes.
 */
export function buildSeriesDetailFeed(
  baseUrl: string,
  seriesData: Series,
  seasonsList: Season[],
  seasonThumbnails?: Map<number, number>,
): string {
  const updated = (seriesData.updatedAt instanceof Date ? seriesData.updatedAt : new Date(seriesData.updatedAt)).toISOString();

  const doc = createFeedDocument({
    id: `${baseUrl}/opds/series/${seriesData.id}`,
    title: seriesData.name,
    baseUrl,
    selfHref: `${baseUrl}/opds/series/${seriesData.id}`,
    feedType: NAVIGATION_TYPE,
  });

  for (const season of seasonsList) {
    const seasonUpdated = (season.updatedAt instanceof Date ? season.updatedAt : new Date(season.updatedAt)).toISOString();

    // Use first volume's thumbnail as season thumbnail
    const volumeId = seasonThumbnails?.get(season.id);
    const thumbnailHref = volumeId
      ? `${baseUrl}/opds/thumbnail/${volumeId}`
      : undefined;

    addNavigationEntry(doc, {
      id: `${baseUrl}/opds/season/${season.id}`,
      title: season.name,
      href: `${baseUrl}/opds/season/${season.id}`,
      type: ACQUISITION_TYPE,
      thumbnailHref,
      updated: seasonUpdated,
    });
  }

  return serializeToXml(doc);
}

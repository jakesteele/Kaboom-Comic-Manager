export interface ParsedFilename {
  seriesName: string;
  seasonIndicator: string | null;
  subtitle: string | null;
  volumeNumber: number | null;
  volumeRangeStart: number | null;
  volumeRangeEnd: number | null;
  year: number | null;
  yearEnd: number | null;
  isDigital: boolean;
  scanGroup: string | null;
}

// Regex patterns for filename parsing
export const EXT_REGEX = /\.(cbz|cbr|epub)$/i;
export const PAREN_GROUP_REGEX = /\(([^)]+)\)/g;
export const BRACKET_GROUP_REGEX = /\[([^\]]+)\]/g;
export const YEAR_SINGLE_REGEX = /^(\d{4})$/;
export const YEAR_RANGE_REGEX = /^(\d{4})\s*[-–]\s*(\d{4})$/;
export const DIGITAL_REGEX = /^Digital$/i;
export const VOLUME_RANGE_PAREN_REGEX = /^v(\d+)\s*[-–]\s*v?(\d+)$/i;
export const VOLUME_SINGLE_REGEX = /\bv(?:ol(?:ume)?)?\.?\s*(\d+)\b/i;
export const VOLUME_RANGE_REGEX = /\bv(?:ol)?\.?\s*(\d+)\s*[-–]\s*v?(\d+)\b/i;
export const BARE_RANGE_REGEX = /\b(\d+)\s*[-–]\s*(\d+)\b/;
export const SEASON_REGEX = /\bSeason\s+(\d+)\b/i;

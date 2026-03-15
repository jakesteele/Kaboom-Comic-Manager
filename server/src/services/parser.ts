import type { ParsedFilename } from '@opds/shared';
import {
  EXT_REGEX,
  PAREN_GROUP_REGEX,
  BRACKET_GROUP_REGEX,
  YEAR_SINGLE_REGEX,
  YEAR_RANGE_REGEX,
  DIGITAL_REGEX,
  VOLUME_RANGE_PAREN_REGEX,
  VOLUME_SINGLE_REGEX,
  VOLUME_RANGE_REGEX,
  BARE_RANGE_REGEX,
  SEASON_REGEX,
} from '@opds/shared';

/**
 * Parse a CBZ filename or folder name into structured metadata.
 * Multi-pass approach: strip metadata from outside in.
 */
export function parseFilename(input: string): ParsedFilename {
  const result: ParsedFilename = {
    seriesName: '',
    seasonIndicator: null,
    subtitle: null,
    volumeNumber: null,
    volumeRangeStart: null,
    volumeRangeEnd: null,
    year: null,
    yearEnd: null,
    isDigital: false,
    scanGroup: null,
  };

  // Step 1: Remove .cbz extension
  let name = input.replace(EXT_REGEX, '').trim();

  // Step 2a: Extract bracket groups [like-this] — typically scan/release groups
  const bracketGroups: string[] = [];
  let match: RegExpExecArray | null;
  const bracketRegex = new RegExp(BRACKET_GROUP_REGEX.source, 'g');

  while ((match = bracketRegex.exec(name)) !== null) {
    bracketGroups.push(match[1]);
  }

  // Bracket groups are almost always scan/release group tags
  if (bracketGroups.length > 0) {
    result.scanGroup = bracketGroups[0];
  }

  // Remove all bracket groups from the name
  name = name.replace(/\[[^\]]*\]/g, '').trim();

  // Step 2b: Extract parenthetical groups right-to-left
  const parenGroups: string[] = [];
  const parenRegex = new RegExp(PAREN_GROUP_REGEX.source, 'g');

  while ((match = parenRegex.exec(name)) !== null) {
    parenGroups.push(match[1]);
  }

  // Classify paren groups (process right-to-left for scan group detection)
  const unclassified: string[] = [];
  for (const group of parenGroups) {
    if (DIGITAL_REGEX.test(group)) {
      result.isDigital = true;
    } else if (YEAR_RANGE_REGEX.test(group)) {
      const m = group.match(YEAR_RANGE_REGEX)!;
      result.year = parseInt(m[1], 10);
      result.yearEnd = parseInt(m[2], 10);
    } else if (YEAR_SINGLE_REGEX.test(group)) {
      result.year = parseInt(group, 10);
    } else if (VOLUME_RANGE_PAREN_REGEX.test(group)) {
      const m = group.match(VOLUME_RANGE_PAREN_REGEX)!;
      result.volumeRangeStart = parseInt(m[1], 10);
      result.volumeRangeEnd = parseInt(m[2], 10);
    } else {
      unclassified.push(group);
    }
  }

  // Last unclassified paren group is likely the scan group (if no bracket group found)
  if (unclassified.length > 0) {
    if (!result.scanGroup) {
      result.scanGroup = unclassified[unclassified.length - 1];
    }
  }

  // Remove all parenthetical groups from the name
  let core = name.replace(/\([^)]*\)/g, '').trim();

  // Step 3: Extract season indicator
  const seasonMatch = core.match(SEASON_REGEX);
  if (seasonMatch) {
    result.seasonIndicator = `Season ${seasonMatch[1]}`;
    core = core.replace(SEASON_REGEX, '').trim();
  }

  // Step 4: Extract volume info (if not already found in parens)
  if (result.volumeRangeStart === null && result.volumeNumber === null) {
    const volRangeMatch = core.match(VOLUME_RANGE_REGEX);
    if (volRangeMatch) {
      result.volumeRangeStart = parseInt(volRangeMatch[1], 10);
      result.volumeRangeEnd = parseInt(volRangeMatch[2], 10);
      core = core.replace(VOLUME_RANGE_REGEX, '').trim();
    } else {
      const volSingleMatch = core.match(VOLUME_SINGLE_REGEX);
      if (volSingleMatch) {
        result.volumeNumber = parseInt(volSingleMatch[1], 10);
        core = core.replace(VOLUME_SINGLE_REGEX, '').trim();
      } else {
        const bareRangeMatch = core.match(BARE_RANGE_REGEX);
        if (bareRangeMatch) {
          result.volumeRangeStart = parseInt(bareRangeMatch[1], 10);
          result.volumeRangeEnd = parseInt(bareRangeMatch[2], 10);
          core = core.replace(BARE_RANGE_REGEX, '').trim();
        }
      }
    }
  }

  // Step 5: Extract subtitle (split on " - ")
  const subtitleIdx = core.indexOf(' - ');
  if (subtitleIdx > 0) {
    result.seriesName = core.substring(0, subtitleIdx).trim();
    result.subtitle = core.substring(subtitleIdx + 3).trim();
  } else {
    result.seriesName = core;
  }

  // Step 5b: Bare trailing number as volume number fallback
  // e.g. "Gleipnir 7" → seriesName "Gleipnir", volumeNumber 7
  if (result.volumeNumber === null && result.volumeRangeStart === null) {
    const bareTrailing = result.seriesName.match(/^(.+?)\s+(\d+)$/);
    if (bareTrailing && bareTrailing[1].length > 0) {
      result.seriesName = bareTrailing[1];
      result.volumeNumber = parseInt(bareTrailing[2], 10);
    }
  }

  // Step 6: Clean up
  result.seriesName = result.seriesName.replace(/\s+/g, ' ').trim();
  if (result.subtitle) {
    result.subtitle = result.subtitle.replace(/\s+/g, ' ').trim();
    if (result.subtitle === '') result.subtitle = null;
  }

  return result;
}

/**
 * Generate a display name for a volume from parsed data.
 */
export function generateDisplayName(parsed: ParsedFilename): string {
  let name = parsed.seriesName;
  if (parsed.subtitle) name += ` - ${parsed.subtitle}`;
  if (parsed.seasonIndicator) name += ` ${parsed.seasonIndicator}`;
  if (parsed.volumeNumber !== null) name += ` Vol. ${parsed.volumeNumber}`;
  return name;
}

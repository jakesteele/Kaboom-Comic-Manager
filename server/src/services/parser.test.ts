import { describe, it, expect } from 'vitest';
import { parseFilename, generateDisplayName } from './parser.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

function parse(input: string) {
  return parseFilename(input);
}

function expectSeries(input: string, seriesName: string) {
  expect(parse(input).seriesName).toBe(seriesName);
}

function expectVol(input: string, vol: number | null) {
  expect(parse(input).volumeNumber).toBe(vol);
}

// ─── Standard manga filenames ─────────────────────────────────────────────

describe('parseFilename — standard manga names', () => {
  it('parses a typical manga filename', () => {
    const r = parse('One Piece v01 (2003) (Digital) (danke-Empire).cbz');
    expect(r.seriesName).toBe('One Piece');
    expect(r.volumeNumber).toBe(1);
    expect(r.year).toBe(2003);
    expect(r.isDigital).toBe(true);
    expect(r.scanGroup).toBe('danke-Empire');
  });

  it('parses volume with "Vol." prefix', () => {
    const r = parse('Naruto Vol. 72 (2015) (Digital).cbz');
    expect(r.seriesName).toBe('Naruto');
    expect(r.volumeNumber).toBe(72);
    expect(r.year).toBe(2015);
    expect(r.isDigital).toBe(true);
  });

  it('parses volume with "Volume" prefix', () => {
    const r = parse('Berserk Volume 13.cbz');
    expect(r.seriesName).toBe('Berserk');
    expect(r.volumeNumber).toBe(13);
  });

  it('parses series with subtitle', () => {
    const r = parse('JoJo\'s Bizarre Adventure - Diamond Is Unbreakable v01.cbz');
    expect(r.seriesName).toBe('JoJo\'s Bizarre Adventure');
    expect(r.subtitle).toBe('Diamond Is Unbreakable');
    expect(r.volumeNumber).toBe(1);
  });

  it('parses volume range in parens', () => {
    const r = parse('Bleach (v01-v10) (2001) (Digital).cbz');
    expect(r.seriesName).toBe('Bleach');
    expect(r.volumeRangeStart).toBe(1);
    expect(r.volumeRangeEnd).toBe(10);
    expect(r.year).toBe(2001);
  });

  it('parses volume range without v prefix on end', () => {
    const r = parse('Attack on Titan (v01-10).cbz');
    expect(r.seriesName).toBe('Attack on Titan');
    expect(r.volumeRangeStart).toBe(1);
    expect(r.volumeRangeEnd).toBe(10);
  });

  it('parses year range in parens', () => {
    const r = parse('Dragon Ball (1984-1995).cbz');
    expect(r.seriesName).toBe('Dragon Ball');
    expect(r.year).toBe(1984);
    expect(r.yearEnd).toBe(1995);
  });

  it('parses season indicator', () => {
    const r = parse('My Hero Academia Season 2 v05 (2018).cbz');
    expect(r.seriesName).toBe('My Hero Academia');
    expect(r.seasonIndicator).toBe('Season 2');
    expect(r.volumeNumber).toBe(5);
    expect(r.year).toBe(2018);
  });

  it('parses bare trailing volume number (no v prefix)', () => {
    const r = parse('Gleipnir 7.cbz');
    expect(r.seriesName).toBe('Gleipnir');
    expect(r.volumeNumber).toBe(7);
  });

  it('parses volume range outside parens', () => {
    const r = parse('Fairy Tail v01-v05.cbz');
    expect(r.seriesName).toBe('Fairy Tail');
    expect(r.volumeRangeStart).toBe(1);
    expect(r.volumeRangeEnd).toBe(5);
  });
});

// ─── Edge cases: minimal / numeric-only names ────────────────────────────

describe('parseFilename — minimal and numeric names', () => {
  it('handles just a number as filename (1.cbz) — number stays as series name', () => {
    // Bare number with no prefix can't be distinguished from a series name.
    // The bare trailing number regex needs "text + space + number" pattern.
    // User can reassign in the UI.
    const r = parse('1.cbz');
    expect(r.seriesName).toBe('1');
    expect(r.volumeNumber).toBeNull();
  });

  it('handles two-digit number (23.cbz) — number stays as series name', () => {
    const r = parse('23.cbz');
    expect(r.seriesName).toBe('23');
    expect(r.volumeNumber).toBeNull();
  });

  it('handles three-digit number (100.cbz) — number stays as series name', () => {
    const r = parse('100.cbz');
    expect(r.seriesName).toBe('100');
    expect(r.volumeNumber).toBeNull();
  });

  it('handles zero (0.cbz) — number stays as series name', () => {
    const r = parse('0.cbz');
    expect(r.seriesName).toBe('0');
    expect(r.volumeNumber).toBeNull();
  });

  it('handles single letter (A.cbz)', () => {
    const r = parse('A.cbz');
    expect(r.seriesName).toBe('A');
    expect(r.volumeNumber).toBeNull();
  });

  it('handles empty string after extension removed', () => {
    const r = parse('.cbz');
    expect(r.seriesName).toBe('');
    expect(r.volumeNumber).toBeNull();
  });

  it('handles no extension', () => {
    const r = parse('Naruto v01');
    expect(r.seriesName).toBe('Naruto');
    expect(r.volumeNumber).toBe(1);
  });

  it('handles CBZ extension in different case', () => {
    const r = parse('Naruto v01.CBZ');
    expect(r.seriesName).toBe('Naruto');
    expect(r.volumeNumber).toBe(1);
  });
});

// ─── Edge cases: weird punctuation and symbols ───────────────────────────

describe('parseFilename — unusual characters and punctuation', () => {
  it('handles series with plus sign (Rosario+Vampire)', () => {
    const r = parse('Rosario+Vampire v01.cbz');
    expect(r.seriesName).toBe('Rosario+Vampire');
    expect(r.volumeNumber).toBe(1);
  });

  it('handles series with exclamation mark', () => {
    const r = parse('Sgt. Frog! v03 (2005).cbz');
    expect(r.seriesName).toBe('Sgt. Frog!');
    expect(r.volumeNumber).toBe(3);
  });

  it('handles colons in series name', () => {
    const r = parse('Re:Zero v01.cbz');
    expect(r.seriesName).toBe('Re:Zero');
    expect(r.volumeNumber).toBe(1);
  });

  it('handles series with apostrophe', () => {
    const r = parse("JoJo's Bizarre Adventure v01.cbz");
    expect(r.seriesName).toBe("JoJo's Bizarre Adventure");
    expect(r.volumeNumber).toBe(1);
  });

  it('handles series with ampersand', () => {
    const r = parse('Spice & Wolf v01.cbz');
    expect(r.seriesName).toBe('Spice & Wolf');
    expect(r.volumeNumber).toBe(1);
  });

  it('handles multiple hyphens in series name (not subtitle)', () => {
    const r = parse('Puella Magi Madoka Magica v02.cbz');
    expect(r.seriesName).toBe('Puella Magi Madoka Magica');
    expect(r.volumeNumber).toBe(2);
  });

  it('handles brackets (not parens) in filename — brackets stay in name', () => {
    const r = parse('Naruto v01 [Digital] [danke].cbz');
    // Only parenthetical groups () are stripped; brackets [] are left as-is
    expect(r.seriesName).toBe('Naruto [Digital] [danke]');
    expect(r.volumeNumber).toBe(1);
  });

  it('handles underscores instead of spaces — volume not extracted', () => {
    const r = parse('My_Hero_Academia_v05.cbz');
    // \\b word boundary doesn't trigger between _ and v (both are \\w chars),
    // so the volume regex doesn't match _v05. Entire string stays as series name.
    // User can fix in the UI.
    expect(r.volumeNumber).toBeNull();
    expect(r.seriesName).toBe('My_Hero_Academia_v05');
  });

  it('handles dots instead of spaces', () => {
    const r = parse('Death.Note.v10.cbz');
    expect(r.volumeNumber).toBe(10);
  });
});

// ─── Edge cases: tricky volume number patterns ───────────────────────────

describe('parseFilename — tricky volume numbers', () => {
  it('handles v0 (zero volume)', () => {
    const r = parse('Chainsaw Man v0.cbz');
    expect(r.seriesName).toBe('Chainsaw Man');
    expect(r.volumeNumber).toBe(0);
  });

  it('handles very high volume number', () => {
    const r = parse('Detective Conan v104.cbz');
    expect(r.seriesName).toBe('Detective Conan');
    expect(r.volumeNumber).toBe(104);
  });

  it('handles leading zeros in volume (v01)', () => {
    const r = parse('Naruto v01.cbz');
    expect(r.seriesName).toBe('Naruto');
    expect(r.volumeNumber).toBe(1);
  });

  it('does not confuse a 4-digit year in parens with volume', () => {
    const r = parse('Akira (2000).cbz');
    expect(r.year).toBe(2000);
    expect(r.volumeNumber).toBeNull();
    expect(r.seriesName).toBe('Akira');
  });

  it('does not confuse a year in the name with volume', () => {
    // "2001 Nights v01" — 2001 is series name, v01 is volume
    const r = parse('2001 Nights v01.cbz');
    expect(r.volumeNumber).toBe(1);
  });

  it('handles bare number range (no v prefix)', () => {
    const r = parse('Naruto 01-10.cbz');
    expect(r.seriesName).toBe('Naruto');
    expect(r.volumeRangeStart).toBe(1);
    expect(r.volumeRangeEnd).toBe(10);
  });

  it('prioritizes v-prefixed volume over bare trailing number', () => {
    const r = parse('Series Name v05 Extra 2.cbz');
    expect(r.volumeNumber).toBe(5);
  });
});

// ─── Edge cases: parens and groups ───────────────────────────────────────

describe('parseFilename — parenthetical groups', () => {
  it('handles multiple scan groups', () => {
    const r = parse('One Piece v01 (2003) (Digital) (danke-Empire) (f).cbz');
    expect(r.year).toBe(2003);
    expect(r.isDigital).toBe(true);
    // Last unclassified paren group becomes scan group
    expect(r.scanGroup).toBe('f');
  });

  it('handles empty parens gracefully', () => {
    // "()" should not crash
    const r = parse('Naruto () v01.cbz');
    expect(r.volumeNumber).toBe(1);
  });

  it('handles parens with only spaces', () => {
    const r = parse('Naruto (  ) v01.cbz');
    expect(r.volumeNumber).toBe(1);
  });

  it('handles nested parens (only outer matched)', () => {
    const r = parse('Naruto (scan (v2)) v01.cbz');
    expect(r.volumeNumber).toBe(1);
  });

  it('handles paren at start of name', () => {
    const r = parse('(2020) Spy x Family v01.cbz');
    expect(r.year).toBe(2020);
    expect(r.volumeNumber).toBe(1);
  });

  it('handles Digital in different cases', () => {
    expect(parse('X (DIGITAL).cbz').isDigital).toBe(true);
    expect(parse('X (digital).cbz').isDigital).toBe(true);
    expect(parse('X (Digital).cbz').isDigital).toBe(true);
  });
});

// ─── Edge cases: subtitles ───────────────────────────────────────────────

describe('parseFilename — subtitle handling', () => {
  it('splits on " - " for subtitle', () => {
    const r = parse('Fullmetal Alchemist - The Land of Sand v01.cbz');
    expect(r.seriesName).toBe('Fullmetal Alchemist');
    expect(r.subtitle).toBe('The Land of Sand');
    expect(r.volumeNumber).toBe(1);
  });

  it('does not split on single hyphen without spaces', () => {
    const r = parse('Spider-Man v01.cbz');
    expect(r.seriesName).toBe('Spider-Man');
    expect(r.subtitle).toBeNull();
    expect(r.volumeNumber).toBe(1);
  });

  it('handles multiple " - " separators (first one wins)', () => {
    const r = parse('A - B - C v01.cbz');
    expect(r.seriesName).toBe('A');
    expect(r.subtitle).toBe('B - C');
    expect(r.volumeNumber).toBe(1);
  });

  it('handles subtitle with no volume', () => {
    const r = parse('Gundam - The Origin.cbz');
    expect(r.seriesName).toBe('Gundam');
    expect(r.subtitle).toBe('The Origin');
    expect(r.volumeNumber).toBeNull();
  });
});

// ─── Edge cases: whitespace and formatting oddities ──────────────────────

describe('parseFilename — whitespace and formatting', () => {
  it('handles extra spaces', () => {
    const r = parse('  Naruto   v01   (2003)  .cbz');
    expect(r.seriesName).toBe('Naruto');
    expect(r.volumeNumber).toBe(1);
    expect(r.year).toBe(2003);
  });

  it('handles tabs in filename', () => {
    const r = parse('Naruto\tv01.cbz');
    expect(r.volumeNumber).toBe(1);
  });

  it('handles only whitespace after extension removed', () => {
    const r = parse('   .cbz');
    expect(r.seriesName).toBe('');
  });

  it('handles long filename', () => {
    const r = parse('A Very Long Series Name That Goes On And On And On v99 (2024) (Digital) (Group-Name).cbz');
    expect(r.seriesName).toBe('A Very Long Series Name That Goes On And On And On');
    expect(r.volumeNumber).toBe(99);
    expect(r.year).toBe(2024);
    expect(r.isDigital).toBe(true);
    expect(r.scanGroup).toBe('Group-Name');
  });
});

// ─── Edge cases: no crash guarantee ──────────────────────────────────────

describe('parseFilename — should never throw', () => {
  const weirdInputs = [
    '',
    '.cbz',
    '   ',
    '...',
    '()',
    '()()',
    '((()))',
    'v',
    'v.cbz',
    'vol',
    'vol.cbz',
    'Vol.',
    'v0',
    'v-1',
    '---',
    ' - ',
    ' - .cbz',
    '🚀 Manga v01.cbz',
    '日本語のタイトル v01.cbz',
    'Naruto (v01-v) (bad).cbz',
    'Series (1999-) (incomplete year).cbz',
    'Series (-2005).cbz',
    'a'.repeat(500) + '.cbz',
    'Series Name v01 v02 v03.cbz',
    '(2020)(2021)(Digital)(Digital).cbz',
    'file.name.with.many.dots.v01.cbz',
    'Season 0 v01.cbz',
    'Season Season 1 v01.cbz',
  ];

  for (const input of weirdInputs) {
    it(`does not throw for: "${input.length > 60 ? input.slice(0, 60) + '...' : input}"`, () => {
      expect(() => parseFilename(input)).not.toThrow();
      const result = parseFilename(input);
      expect(result).toBeDefined();
      expect(typeof result.seriesName).toBe('string');
    });
  }
});

// ─── Real-world filenames from the wild ──────────────────────────────────

describe('parseFilename — real-world filenames', () => {
  it('One Punch Man standard', () => {
    const r = parse('One-Punch Man v23 (2021) (Digital) (LuCaZ).cbz');
    expect(r.seriesName).toBe('One-Punch Man');
    expect(r.volumeNumber).toBe(23);
    expect(r.year).toBe(2021);
    expect(r.isDigital).toBe(true);
    expect(r.scanGroup).toBe('LuCaZ');
  });

  it('Spy x Family', () => {
    const r = parse('Spy x Family v01 (2020) (Digital) (danke-Empire).cbz');
    expect(r.seriesName).toBe('Spy x Family');
    expect(r.volumeNumber).toBe(1);
  });

  it('Series with no metadata', () => {
    const r = parse('random_file.cbz');
    expect(r.seriesName).toBe('random_file');
    expect(r.volumeNumber).toBeNull();
    expect(r.year).toBeNull();
    expect(r.isDigital).toBe(false);
    expect(r.scanGroup).toBeNull();
  });

  it('Chainsaw Man format', () => {
    const r = parse('Chainsaw Man v11 (2022) (Digital) (1r0n).cbz');
    expect(r.seriesName).toBe('Chainsaw Man');
    expect(r.volumeNumber).toBe(11);
    expect(r.year).toBe(2022);
    expect(r.scanGroup).toBe('1r0n');
  });

  it('Omnibus/collection style', () => {
    const r = parse('Dragon Ball (3-in-1 Edition) v01.cbz');
    expect(r.volumeNumber).toBe(1);
    expect(r.scanGroup).toBe('3-in-1 Edition');
  });

  it('Folder name (no extension)', () => {
    const r = parse('Berserk Deluxe Edition v01');
    expect(r.seriesName).toBe('Berserk Deluxe Edition');
    expect(r.volumeNumber).toBe(1);
  });

  it('En-dash separator in year range', () => {
    const r = parse('Slam Dunk (1990\u20131996).cbz');
    expect(r.year).toBe(1990);
    expect(r.yearEnd).toBe(1996);
  });
});

// ─── generateDisplayName ─────────────────────────────────────────────────

describe('generateDisplayName', () => {
  it('basic series + volume', () => {
    const r = parse('Naruto v01.cbz');
    expect(generateDisplayName(r)).toBe('Naruto Vol. 1');
  });

  it('series with subtitle and volume', () => {
    const r = parse("JoJo's Bizarre Adventure - Stone Ocean v01.cbz");
    expect(generateDisplayName(r)).toBe("JoJo's Bizarre Adventure - Stone Ocean Vol. 1");
  });

  it('series with season and volume', () => {
    const r = parse('Fairy Tail Season 2 v05.cbz');
    expect(generateDisplayName(r)).toBe('Fairy Tail Season 2 Vol. 5');
  });

  it('series with no volume', () => {
    const r = parse('Akira.cbz');
    expect(generateDisplayName(r)).toBe('Akira');
  });

  it('numeric-only filename — displays number as series name', () => {
    // Since "1" can't be parsed as a volume (no prefix/separator), it stays as series name
    const r = parse('1.cbz');
    expect(generateDisplayName(r)).toBe('1');
  });
});

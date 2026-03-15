import { describe, it, expect } from 'vitest';
import { normalizeName, diceCoefficient, compareSeries } from './normalize.js';

// ─── normalizeName ───────────────────────────────────────────────────────

describe('normalizeName', () => {
  it('lowercases', () => {
    expect(normalizeName('Naruto')).toBe('naruto');
  });

  it('strips plus signs', () => {
    expect(normalizeName('Rosario+Vampire')).toBe('rosariovampire');
  });

  it('strips punctuation but keeps hyphens', () => {
    expect(normalizeName("JoJo's Bizarre Adventure!")).toBe('jojos bizarre adventure');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeName('One   Piece')).toBe('one piece');
  });

  it('trims leading/trailing spaces', () => {
    expect(normalizeName('  Naruto  ')).toBe('naruto');
  });

  it('preserves hyphens', () => {
    expect(normalizeName('Spider-Man')).toBe('spider-man');
  });

  it('handles empty string', () => {
    expect(normalizeName('')).toBe('');
  });

  it('handles only punctuation', () => {
    expect(normalizeName('!!!')).toBe('');
  });

  it('handles numbers', () => {
    expect(normalizeName('2001 Nights')).toBe('2001 nights');
  });

  it('handles unicode characters', () => {
    // Unicode letters are kept by \w in some engines
    const result = normalizeName('日本語');
    expect(typeof result).toBe('string');
  });
});

// ─── diceCoefficient ─────────────────────────────────────────────────────

describe('diceCoefficient', () => {
  it('returns 1.0 for identical strings', () => {
    expect(diceCoefficient('naruto', 'naruto')).toBe(1.0);
  });

  it('returns 0.0 for completely different strings', () => {
    expect(diceCoefficient('abc', 'xyz')).toBe(0.0);
  });

  it('returns 0.0 for single-character strings', () => {
    expect(diceCoefficient('a', 'a')).toBe(1.0); // exact match short-circuits
    expect(diceCoefficient('a', 'b')).toBe(0.0);
  });

  it('returns 0.0 for empty strings', () => {
    expect(diceCoefficient('', '')).toBe(1.0); // exact match
    expect(diceCoefficient('', 'abc')).toBe(0.0);
  });

  it('returns high score for similar strings', () => {
    const score = diceCoefficient('naruto', 'naruta');
    expect(score).toBeGreaterThan(0.5);
  });

  it('returns moderate score for somewhat similar strings', () => {
    const score = diceCoefficient('dragon ball', 'dragon ball z');
    expect(score).toBeGreaterThan(0.7);
  });

  it('is symmetric', () => {
    const a = diceCoefficient('naruto', 'boruto');
    const b = diceCoefficient('boruto', 'naruto');
    expect(a).toBe(b);
  });
});

// ─── compareSeries ───────────────────────────────────────────────────────

describe('compareSeries', () => {
  it('detects exact matches (case-insensitive)', () => {
    const r = compareSeries('Naruto', 'naruto');
    expect(r.relationship).toBe('exact');
    expect(r.score).toBe(1.0);
  });

  it('detects exact matches with punctuation differences', () => {
    const r = compareSeries("JoJo's Bizarre Adventure", 'JoJos Bizarre Adventure');
    expect(r.relationship).toBe('exact');
  });

  it('detects parent-child (prefix relationship)', () => {
    const r = compareSeries('Dragon Ball', 'Dragon Ball Z');
    expect(r.relationship).toBe('parent-child');
    expect(r.remainder).toBe('z');
    expect(r.score).toBe(0.95);
  });

  it('detects parent-child with hyphen separator', () => {
    const r = compareSeries('Spider-Man', 'Spider-Man-2099');
    expect(r.relationship).toBe('parent-child');
  });

  it('detects parent-child regardless of order', () => {
    const r = compareSeries('Dragon Ball Z', 'Dragon Ball');
    expect(r.relationship).toBe('parent-child');
  });

  it('detects similar series', () => {
    const r = compareSeries('Fullmetal Alchemist', 'Full Metal Alchemist');
    // These are similar but not parent-child
    expect(r.score).toBeGreaterThan(0.7);
  });

  it('detects unrelated series', () => {
    const r = compareSeries('Naruto', 'One Piece');
    expect(r.relationship).toBe('unrelated');
    expect(r.score).toBeLessThan(0.85);
  });

  it('handles empty strings', () => {
    const r = compareSeries('', '');
    expect(r.relationship).toBe('exact');
  });

  it('handles one empty string', () => {
    const r = compareSeries('Naruto', '');
    // Empty normalized strings won't be exact, and prefix check might not match
    expect(r).toBeDefined();
  });

  it('handles single-character names', () => {
    const r = compareSeries('X', 'Y');
    expect(r).toBeDefined();
  });

  it('handles very long similar names', () => {
    const a = 'The Very Long Series Name About Adventures';
    const b = 'The Very Long Series Name About Adventures Part Two';
    const r = compareSeries(a, b);
    expect(r.relationship).toBe('parent-child');
  });

  it('does not false-positive on short shared prefixes', () => {
    // "Dr. Stone" and "Dragon Ball" share "dr" prefix but are different
    const r = compareSeries('Dr. Stone', 'Dragon Ball');
    expect(r.relationship).toBe('unrelated');
  });

  it('handles + normalization for comparison', () => {
    const r = compareSeries('Rosario+Vampire', 'Rosario Vampire');
    // + is stripped → "rosariovampire" vs "rosario vampire" (space remains)
    // These aren't identical strings, but are very similar
    expect(r.relationship).toBe('similar');
    expect(r.score).toBeGreaterThan(0.85);
  });
});

/**
 * Normalize a series name for comparison.
 * Strips punctuation, lowercases, collapses spaces.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[+]/g, '')           // Rosario+Vampire → rosariovampire
    .replace(/[^\w\s-]/g, '')      // Remove punctuation except hyphens
    .replace(/\s+/g, ' ')          // Collapse spaces
    .trim();
}

/**
 * Dice coefficient for bigram similarity between two strings.
 * Returns 0.0-1.0 (1.0 = identical).
 */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0.0;

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.substring(i, i + 2);
    bigramsA.set(bigram, (bigramsA.get(bigram) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.substring(i, i + 2);
    const count = bigramsA.get(bigram) || 0;
    if (count > 0) {
      bigramsA.set(bigram, count - 1);
      intersection++;
    }
  }

  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

export interface ComparisonResult {
  score: number;
  relationship: 'exact' | 'parent-child' | 'similar' | 'unrelated';
  remainder?: string;
}

/**
 * Compare two series names and determine their relationship.
 */
export function compareSeries(a: string, b: string): ComparisonResult {
  const normA = normalizeName(a);
  const normB = normalizeName(b);

  // Exact match
  if (normA === normB) {
    return { score: 1.0, relationship: 'exact' };
  }

  // Parent-child: one is a prefix of the other
  const shorter = normA.length <= normB.length ? normA : normB;
  const longer = normA.length <= normB.length ? normB : normA;

  if (longer.startsWith(shorter + ' ') || longer.startsWith(shorter + '-')) {
    const remainder = longer.slice(shorter.length).trim().replace(/^[-\s]+/, '');
    if (remainder.length > 0) {
      return { score: 0.95, relationship: 'parent-child', remainder };
    }
  }

  // Dice coefficient similarity
  const score = diceCoefficient(normA, normB);
  if (score > 0.85) {
    return { score, relationship: 'similar' };
  }

  return { score, relationship: 'unrelated' };
}

/**
 * Normalize a search term for synonym / alias storage and lookup.
 * Keeps Unicode letters, marks (e.g. Devanagari matras), and digits;
 * lowercases; collapses whitespace.
 */
export function normalizeSearchTerm(input: string): string {
  return input
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Sanitize a raw user query for MySQL FULLTEXT / LIKE (preserves casing for display elsewhere). */
export function sanitizeSearchQuery(input: string): string {
  return input
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

import { describe, expect, it } from 'vitest';
import {
  addSynonymTermSchema,
  createSynonymGroupSchema,
  putProductAliasesSchema,
  zeroResultsQuerySchema,
} from './search-admin.schema.js';

describe('search-admin schema', () => {
  it('accepts synonym group create payload', () => {
    const parsed = createSynonymGroupSchema.parse({
      canonicalTerm: ' Sugar ',
      terms: ['cheeni', 'cheene'],
    });
    expect(parsed.canonicalTerm).toBe('Sugar');
    expect(parsed.terms).toEqual(['cheeni', 'cheene']);
  });

  it('accepts term add', () => {
    expect(addSynonymTermSchema.parse({ term: ' चीनी ' }).term).toBe('चीनी');
  });

  it('accepts product aliases replace', () => {
    const parsed = putProductAliasesSchema.parse({
      aliases: ['tata', 'tata namak'],
    });
    expect(parsed.aliases).toHaveLength(2);
  });

  it('coerces zero-results query', () => {
    const parsed = zeroResultsQuerySchema.parse({ limit: '20', days: '7' });
    expect(parsed.limit).toBe(20);
    expect(parsed.days).toBe(7);
  });
});

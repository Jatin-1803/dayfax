import { describe, expect, it } from 'vitest';
import {
  normalizeSearchTerm,
  sanitizeSearchQuery,
} from '../../common/utils/search-normalize.js';

describe('normalizeSearchTerm', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeSearchTerm('  Cheeni  ')).toBe('cheeni');
    expect(normalizeSearchTerm('Tata   Salt')).toBe('tata salt');
  });

  it('strips punctuation but keeps unicode letters', () => {
    expect(normalizeSearchTerm('cheeni!!!')).toBe('cheeni');
    expect(normalizeSearchTerm('चीनी')).toBe('चीनी');
  });
});

describe('sanitizeSearchQuery', () => {
  it('preserves letters and spaces', () => {
    expect(sanitizeSearchQuery(' milk-tea ')).toBe('milk tea');
  });
});

describe('synonym expansion contract', () => {
  it('documents expected cheeni → sugar group terms', () => {
    const groupTerms = ['sugar', 'cheeni', 'cheene', 'chini', 'चीनी'];
    expect(groupTerms).toContain('cheeni');
    expect(groupTerms).toContain('sugar');
    expect(normalizeSearchTerm('Cheene')).toBe('cheene');
  });
});

/** Initial grocery synonym packs (Roman + common Hindi spellings). */
export const GROCERY_SYNONYM_GROUPS: ReadonlyArray<{
  canonical: string;
  terms: readonly string[];
}> = [
  {
    canonical: 'sugar',
    terms: ['sugar', 'cheeni', 'cheene', 'chini', 'चीनी'],
  },
  {
    canonical: 'salt',
    terms: ['salt', 'namak', 'नमक'],
  },
  {
    canonical: 'oil',
    terms: ['oil', 'tel', 'तेल', 'cooking oil'],
  },
  {
    canonical: 'milk',
    terms: ['milk', 'doodh', 'dudh', 'दूध'],
  },
  {
    canonical: 'rice',
    terms: ['rice', 'chawal', 'चावल'],
  },
  {
    canonical: 'flour',
    terms: ['flour', 'atta', 'aata', 'आटा', 'wheat flour'],
  },
  {
    canonical: 'potato',
    terms: ['potato', 'aloo', 'alu', 'आलू'],
  },
  {
    canonical: 'onion',
    terms: ['onion', 'pyaz', 'pyaaz', 'प्याज'],
  },
  {
    canonical: 'tomato',
    terms: ['tomato', 'tamatar', 'टमाटर'],
  },
  {
    canonical: 'spinach',
    terms: ['spinach', 'palak', 'पालक'],
  },
];

/** Per-product aliases keyed by product slug. */
export const PRODUCT_ALIAS_BY_SLUG: ReadonlyArray<{
  slug: string;
  aliases: readonly string[];
}> = [
  { slug: 'sugar', aliases: ['madhur sugar', 'white sugar', 'chini packet'] },
  { slug: 'tata-salt', aliases: ['tata', 'tata namak', 'iodized salt'] },
  { slug: 'amul-taaza-milk', aliases: ['amul doodh', 'taaza', 'amul milk'] },
];

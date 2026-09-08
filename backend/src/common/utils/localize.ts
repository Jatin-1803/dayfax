import type { AppLang } from '../../modules/i18n/i18n.schema.js';

export function pickLocalized(
  lang: AppLang,
  english: string | null | undefined,
  hindi: string | null | undefined,
): string | null {
  if (lang === 'hi') {
    const hi = hindi?.trim();
    if (hi) return hi;
  }
  const en = english?.trim();
  return en || null;
}

export function pickLocalizedRequired(
  lang: AppLang,
  english: string,
  hindi: string | null | undefined,
): string {
  return pickLocalized(lang, english, hindi) ?? english;
}

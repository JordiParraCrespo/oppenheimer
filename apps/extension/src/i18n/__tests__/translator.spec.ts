import { describe, expect, it } from 'vitest';
import { CATALOGS } from '../catalogs';
import { createTranslator, languageOf, reasonText } from '../translator';

/** Every word the extension shows, in the reader's language when there is copy for it. */
describe('translator', () => {
  it('speaks Spanish to a Spanish Chrome and English to everyone else', () => {
    expect(languageOf('es-ES')).toBe('es');
    expect(languageOf('en-GB')).toBe('en');
    expect(languageOf('fr')).toBe('en');
  });

  it('words a reason by its code, and keeps the server’s own words', () => {
    const { t } = createTranslator('es-ES');
    expect(reasonText(t, { code: 'tool', tool: 'Bash' })).toBe('Quiere usar Bash');
    expect(reasonText(t, { code: 'detail', text: 'tests are red' })).toBe('tests are red');
    expect(reasonText(t, null)).toBeNull();
  });

  it('counts in the reader’s plural', () => {
    expect(createTranslator('en').t('badge.needsYou', { count: 1 })).toBe(
      '1 Claude Code session needs you',
    );
    expect(createTranslator('es').t('badge.needsYou', { count: 2 })).toBe(
      '2 sesiones de Claude Code te necesitan',
    );
  });

  it('has the same words in every language', () => {
    // A counted word's plural forms differ by language (Spanish has `_many`,
    // English does not), so the words are compared, not their forms.
    const keys = (catalog: object, prefix = ''): string[] =>
      Object.entries(catalog).flatMap(([key, value]) =>
        typeof value === 'object'
          ? keys(value, `${prefix}${key}.`)
          : [`${prefix}${key.replace(/_(zero|one|two|few|many|other)$/, '')}`],
      );
    const words = (catalog: object) => [...new Set(keys(catalog))].sort();
    expect(words(CATALOGS.es)).toEqual(words(CATALOGS.en));
  });

  it('counts a million in Spanish with its own form, not the raw key', () => {
    const t = createTranslator('es').t;
    // Without `_many`, i18next falls back to the English catalog here.
    expect(t('badge.needsYou', { count: 1_000_000 })).toBe(
      '1000000 sesiones de Claude Code te necesitan',
    );
  });
});

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
    const keys = (catalog: object, prefix = ''): string[] =>
      Object.entries(catalog).flatMap(([key, value]) =>
        typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
      );
    expect(keys(CATALOGS.es).sort()).toEqual(keys(CATALOGS.en).sort());
  });
});

import { describe, expect, it, vi } from 'vitest';
import { Translator } from '../translator';

const bundles = {
  en: {
    inbox: {
      types: {
        lead: {
          created: {
            title: 'New lead from {{domain}}',
            preview: '{{leadName}} · {{company}} · {{value}}',
          },
        },
      },
      summary_one: '{{count}} unread notification',
      summary_other: '{{count}} unread notifications',
      onlyEnglish: 'Only in English',
    },
  },
  es: {
    inbox: {
      types: {
        lead: {
          created: {
            title: 'Nuevo lead desde {{domain}}',
            preview: '{{leadName}} · {{company}} · {{value}}',
          },
        },
      },
      summary_one: '{{count}} notificación sin leer',
      summary_other: '{{count}} notificaciones sin leer',
    },
  },
};

function translator() {
  return new Translator(bundles, {
    defaultLocale: 'en',
    onMissingKey: () => {},
  });
}

describe('Translator', () => {
  it('resolves a dotted key and interpolates', () => {
    expect(
      translator().t('en', 'inbox.types.lead.created.title', {
        domain: 'adrirodrigo.es',
      }),
    ).toBe('New lead from adrirodrigo.es');
  });

  it('renders the requested locale, not the default one', () => {
    expect(
      translator().t('es', 'inbox.types.lead.created.title', {
        domain: 'adrirodrigo.es',
      }),
    ).toBe('Nuevo lead desde adrirodrigo.es');
  });

  it('falls back to the default locale for a key the requested one lacks', () => {
    expect(translator().t('es', 'inbox.onlyEnglish')).toBe('Only in English');
  });

  it('returns the key path rather than throwing when nothing resolves', () => {
    expect(translator().t('en', 'inbox.nope.missing')).toBe('inbox.nope.missing');
  });

  it('warns once per missing key, not once per call', () => {
    const onMissingKey = vi.fn();
    const subject = new Translator(bundles, { onMissingKey });

    subject.t('en', 'inbox.missing');
    subject.t('en', 'inbox.missing');
    subject.t('en', 'inbox.alsoMissing');

    expect(onMissingKey).toHaveBeenCalledTimes(2);
  });

  it('selects the plural form for the locale', () => {
    const subject = translator();
    expect(subject.t('en', 'inbox.summary', { count: 1 })).toBe('1 unread notification');
    expect(subject.t('en', 'inbox.summary', { count: 4 })).toBe('4 unread notifications');
    expect(subject.t('es', 'inbox.summary', { count: 1 })).toBe('1 notificación sin leer');
    expect(subject.t('es', 'inbox.summary', { count: 4 })).toBe('4 notificaciones sin leer');
  });

  it('renders an unknown placeholder as a gap, never as a raw token', () => {
    expect(translator().t('en', 'inbox.types.lead.created.title', {})).toBe('New lead from ');
  });

  it('treats a null variable as absent', () => {
    expect(
      translator().t('en', 'inbox.types.lead.created.preview', {
        leadName: 'Amara',
        company: null,
        value: '€31,400.00',
      }),
    ).toBe('Amara ·  · €31,400.00');
  });

  describe('negotiate', () => {
    it('takes the first candidate that has a bundle', () => {
      expect(translator().negotiate(null, 'es', 'en')).toBe('es');
    });

    it('falls back from a regional tag to its primary subtag', () => {
      expect(translator().negotiate('es-ES')).toBe('es');
    });

    it('falls back to the default locale when nothing matches', () => {
      expect(translator().negotiate('de', 'fr')).toBe('en');
    });

    it('skips empty candidates', () => {
      expect(translator().negotiate(undefined, null, '', 'es')).toBe('es');
    });
  });

  describe('optional', () => {
    it('returns undefined for a missing key so callers can branch', () => {
      expect(translator().optional('en', 'inbox.nope')).toBeUndefined();
    });

    it('behaves like t() for a present key', () => {
      expect(translator().optional('en', 'inbox.onlyEnglish')).toBe('Only in English');
    });
  });

  it('reports which locales it can render', () => {
    expect(translator().locales()).toEqual(['en', 'es']);
    expect(translator().supports('es')).toBe(true);
    expect(translator().supports('de')).toBe(false);
  });
});

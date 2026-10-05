import { describe, expect, it } from 'vitest';
import { I18nService } from '../i18n.service';

const bundles = {
  en: {
    common: {
      relative: {
        now: 'now',
        minute: '{{count}}m',
        hour: '{{count}}h',
        day: '{{count}}d',
        week: '{{count}}w',
        month: '{{count}}mo',
        year: '{{count}}y',
      },
    },
    inbox: { greeting: 'Hello {{name}}' },
  },
  es: {
    common: {
      relative: {
        now: 'ahora',
        minute: '{{count}}min',
        hour: '{{count}}h',
        day: '{{count}}d',
        week: '{{count}}sem',
        month: '{{count}}mes',
        year: '{{count}}a',
      },
    },
    inbox: { greeting: 'Hola {{name}}' },
  },
};

const NOW = new Date('2026-08-08T12:00:00Z');

function service() {
  return new I18nService({
    bundles,
    defaultLocale: 'en',
    defaultTimeZone: 'UTC',
    onMissingKey: () => {},
    now: () => NOW,
  });
}

describe('I18nService', () => {
  it('binds a formatter to one locale so two readers cannot be mixed', () => {
    const subject = service();
    expect(subject.for('en').t('inbox.greeting', { name: 'Adri' })).toBe('Hello Adri');
    expect(subject.for('es').t('inbox.greeting', { name: 'Adri' })).toBe('Hola Adri');
  });

  it('renders the compact stamp from the copy tree, not from code', () => {
    const subject = service();
    expect(subject.for('en').relativeShort(new Date('2026-08-08T11:48:00Z'))).toBe('12m');
    expect(subject.for('es').relativeShort(new Date('2026-08-08T11:48:00Z'))).toBe('12min');
    expect(subject.for('en').relativeShort(new Date('2026-08-07T12:00:00Z'))).toBe('1d');
  });

  it('groups by the bound timezone', () => {
    const subject = service();
    const lateNight = new Date('2026-08-07T23:30:00Z');
    expect(subject.for('en', 'UTC').dayBucket(lateNight)).toBe('yesterday');
    expect(subject.for('en', 'Europe/Madrid').dayBucket(lateNight)).toBe('today');
  });
});

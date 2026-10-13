import { describe, expect, it } from 'vitest';
import { dropDuplicateEvents } from '../domain/calendar-event-dedupe.policy';
import { googleEventsToProvider } from '../infrastructure/google-calendar-event.util';

/**
 * One meeting invited to two of a person's addresses is drawn once, and a
 * recurring one keeps every occurrence. What breaks if this regresses: every
 * shared meeting shows twice, or a weekly meeting shows only its first week
 * because every instance shares one `iCalUID`.
 */
describe('dropDuplicateEvents', () => {
  const range = { from: '2026-10-01', to: '2026-10-31' };
  const weekly = (account: string) =>
    ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].map((day) => ({
      id: `${account}_${day}`,
      iCalUID: 'weekly-sync@acme',
      summary: 'Weekly sync',
      originalStartTime: { dateTime: `${day}T09:00:00+02:00` },
      start: { dateTime: `${day}T09:00:00+02:00` },
      end: { dateTime: `${day}T09:30:00+02:00` },
    }));
  const read = (connectionId: string, items: unknown[]) =>
    googleEventsToProvider({ items }, range).map((event) => ({ connectionId, event }));

  it('draws a recurring meeting invited to two accounts once per occurrence, from the first account', () => {
    const kept = dropDuplicateEvents(
      [...read('work', weekly('work')), ...read('home', weekly('home'))],
      ({ event }) => event.dedupeKey,
    );
    expect(kept.map(({ connectionId, event }) => [connectionId, event.date])).toEqual([
      ['work', '2026-10-05'],
      ['work', '2026-10-12'],
      ['work', '2026-10-19'],
      ['work', '2026-10-26'],
    ]);
  });

  it('keeps two different meetings at the same time, and an all-day event on each of its days', () => {
    const kept = dropDuplicateEvents(
      [
        ...read('work', [
          { id: 'x', iCalUID: 'x@acme', start: { dateTime: '2026-10-05T09:00:00Z' } },
          {
            id: 'trip',
            iCalUID: 'trip@acme',
            start: { date: '2026-10-07' },
            end: { date: '2026-10-09' },
          },
        ]),
        ...read('home', [
          { id: 'y', iCalUID: 'y@home', start: { dateTime: '2026-10-05T09:00:00Z' } },
          {
            id: 'trip',
            iCalUID: 'trip@acme',
            start: { date: '2026-10-07' },
            end: { date: '2026-10-09' },
          },
        ]),
      ],
      ({ event }) => event.dedupeKey,
    );
    expect(kept.map(({ connectionId, event }) => [connectionId, event.id])).toEqual([
      ['work', 'x'],
      ['work', 'trip:2026-10-07'],
      ['work', 'trip:2026-10-08'],
      ['home', 'y'],
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { googleEventsToProvider } from '../infrastructure/google-calendar-event.util';

/**
 * Google's events as the month view draws them. What breaks if this regresses:
 * a cancelled meeting still shows, a holiday spanning a week shows on its first
 * day only, or an evening event that runs past midnight is drawn ending before
 * it starts.
 */
describe('googleEventsToProvider', () => {
  const range = { from: '2026-10-01', to: '2026-10-31' };

  it('draws a timed event on its day in the zone Google answered in, and drops cancelled ones', () => {
    const events = googleEventsToProvider(
      {
        items: [
          {
            id: 'a',
            summary: 'Design review',
            start: { dateTime: '2026-10-05T15:00:00+02:00' },
            end: { dateTime: '2026-10-05T16:00:00+02:00' },
            htmlLink: 'https://calendar.google.com/a',
          },
          { id: 'b', status: 'cancelled', start: { dateTime: '2026-10-06T10:00:00+02:00' } },
        ],
      },
      range,
    );
    expect(events).toEqual([
      {
        id: 'a',
        title: 'Design review',
        date: '2026-10-05',
        allDay: false,
        startTime: '15:00',
        endTime: '16:00',
        busy: true,
        url: 'https://calendar.google.com/a',
      },
    ]);
  });

  it('splits an all-day event across its days, inside the range only, and keeps free time free', () => {
    const events = googleEventsToProvider(
      {
        items: [
          {
            id: 'trip',
            summary: 'Lisbon',
            transparency: 'transparent',
            start: { date: '2026-09-30' },
            end: { date: '2026-10-03' },
          },
        ],
      },
      range,
    );
    expect(events.map((e) => [e.id, e.date, e.allDay, e.busy])).toEqual([
      ['trip:2026-10-01', '2026-10-01', true, false],
      ['trip:2026-10-02', '2026-10-02', true, false],
    ]);
  });

  it('ends an event that runs past midnight at the end of its first day', () => {
    const [late] = googleEventsToProvider(
      {
        items: [
          {
            id: 'late',
            start: { dateTime: '2026-10-09T22:00:00+02:00' },
            end: { dateTime: '2026-10-10T01:00:00+02:00' },
          },
        ],
      },
      range,
    );
    expect([late.startTime, late.endTime, late.title]).toEqual(['22:00', '23:59', '']);
  });
});

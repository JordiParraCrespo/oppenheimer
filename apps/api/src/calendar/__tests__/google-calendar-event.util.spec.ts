import { describe, expect, it } from 'vitest';
import {
  accountOfIdToken,
  googleEventsToProvider,
} from '../infrastructure/google-calendar-event.util';

/**
 * Google's events as the month view draws them. What breaks if this regresses:
 * a cancelled meeting still shows, a holiday spanning a week shows on its first
 * day only, an evening event that runs past midnight is drawn ending before
 * it starts, or a meeting loses its join link (or offers one that is not
 * `https:`).
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
        meetingUrl: null,
        dedupeKey: 'a|2026-10-05T13:00:00.000Z',
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

  it('finds where to join: Meet first, then an add-on’s video link, then a location that is an https address', () => {
    const at = { start: { dateTime: '2026-10-05T09:00:00Z' } };
    const events = googleEventsToProvider(
      {
        items: [
          {
            id: 'meet',
            ...at,
            hangoutLink: 'https://meet.google.com/abc-defg-hij',
            conferenceData: {
              entryPoints: [{ entryPointType: 'video', uri: 'https://zoom.us/j/1' }],
            },
          },
          {
            id: 'zoom',
            ...at,
            conferenceData: {
              entryPoints: [
                { entryPointType: 'phone', uri: 'tel:+34-900' },
                { entryPointType: 'video', uri: 'https://zoom.us/j/2' },
              ],
            },
          },
          { id: 'pasted', ...at, location: ' https://teams.microsoft.com/l/meetup/3 ' },
          { id: 'room', ...at, location: 'Room 4' },
          { id: 'prose', ...at, location: 'https://example.com/call or Room 4' },
          { id: 'unsafe', ...at, hangoutLink: 'javascript:alert(1)', location: 'http://x.test' },
        ],
      },
      range,
    );
    expect(events.map((e) => [e.id, e.meetingUrl])).toEqual([
      ['meet', 'https://meet.google.com/abc-defg-hij'],
      ['zoom', 'https://zoom.us/j/2'],
      ['pasted', 'https://teams.microsoft.com/l/meetup/3'],
      ['room', null],
      ['prose', null],
      ['unsafe', null],
    ]);
  });

  it('finds a Zoom, Teams or Webex join link written in the location or the description, and nothing else', () => {
    const at = { start: { dateTime: '2026-10-05T09:00:00Z' } };
    const events = googleEventsToProvider(
      {
        items: [
          {
            id: 'zoom-location',
            ...at,
            location: 'Zoom: https://acme.zoom.us/j/123?pwd=x (or Room 4)',
          },
          {
            id: 'zoom-html',
            ...at,
            description:
              'Join: <a href="https://us02web.zoom.us/j/456?pwd=a&amp;from=addon">https://us02web.zoom.us/j/456</a>.',
          },
          {
            id: 'teams',
            ...at,
            description:
              'Agenda https://docs.example.com/x then https://teams.microsoft.com/l/meetup-join/7.',
          },
          { id: 'webex', ...at, location: 'https://acme.webex.com/meet/ana, floor 2' },
          {
            id: 'location-first',
            ...at,
            location: 'Call https://acme.zoom.us/j/1',
            description: 'https://acme.zoom.us/j/2',
          },
          {
            id: 'not-a-meeting',
            ...at,
            description: 'Get the app https://zoom.us/download and https://example.com/j/1',
          },
          { id: 'http', ...at, description: 'http://acme.zoom.us/j/9' },
        ],
      },
      range,
    );
    expect(events.map((e) => [e.id, e.meetingUrl])).toEqual([
      ['zoom-location', 'https://acme.zoom.us/j/123?pwd=x'],
      ['zoom-html', 'https://us02web.zoom.us/j/456?pwd=a&from=addon'],
      ['teams', 'https://teams.microsoft.com/l/meetup-join/7'],
      ['webex', 'https://acme.webex.com/meet/ana'],
      ['location-first', 'https://acme.zoom.us/j/1'],
      ['not-a-meeting', null],
      ['http', null],
    ]);
  });

  it('keys two accounts’ copies of one meeting the same, whatever offset each answered in', () => {
    const copy = (id: string, start: string) =>
      googleEventsToProvider(
        {
          items: [
            { id, iCalUID: 'standup@acme', start: { dateTime: start }, end: { dateTime: start } },
          ],
        },
        range,
      )[0];
    expect(copy('a1', '2026-10-05T09:00:00+02:00').dedupeKey).toBe(
      copy('b7', '2026-10-05T07:00:00Z').dedupeKey,
    );
  });

  it('keys each instance of a recurring meeting by its own occurrence, a moved one by where it was', () => {
    const [monday, tuesday, moved] = googleEventsToProvider(
      {
        items: [
          {
            id: 'weekly_20261005',
            iCalUID: 'weekly@acme',
            originalStartTime: { dateTime: '2026-10-05T09:00:00Z' },
            start: { dateTime: '2026-10-05T09:00:00Z' },
          },
          {
            id: 'weekly_20261012',
            iCalUID: 'weekly@acme',
            originalStartTime: { dateTime: '2026-10-12T09:00:00Z' },
            start: { dateTime: '2026-10-12T09:00:00Z' },
          },
          {
            id: 'weekly_20261019',
            iCalUID: 'weekly@acme',
            originalStartTime: { dateTime: '2026-10-19T09:00:00Z' },
            start: { dateTime: '2026-10-20T11:00:00Z' },
          },
        ],
      },
      range,
    );
    expect(new Set([monday.dedupeKey, tuesday.dedupeKey, moved.dedupeKey]).size).toBe(3);
    expect(moved.dedupeKey).toBe('weekly@acme|2026-10-19T09:00:00.000Z');
  });
});

/**
 * The account a token response is for. What breaks if this regresses: a grant
 * is stored without the `sub` that tells one account from another, or one
 * without an address is accepted.
 */
describe('accountOfIdToken', () => {
  const token = (claims: object) =>
    `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;

  it('reads the subject and the address', () => {
    expect(accountOfIdToken(token({ sub: '1098', email: 'ana@example.com' }))).toEqual({
      subject: '1098',
      email: 'ana@example.com',
    });
  });

  it('is nothing without a token, a subject or an address', () => {
    expect(accountOfIdToken(undefined)).toBeNull();
    expect(accountOfIdToken('not-a-jwt')).toBeNull();
    expect(accountOfIdToken(token({ email: 'ana@example.com' }))).toBeNull();
    expect(accountOfIdToken(token({ sub: '1098' }))).toBeNull();
  });
});

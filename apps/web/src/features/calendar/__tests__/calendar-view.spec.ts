import { describe, expect, it } from 'vitest';
import { calendarSearchSchema } from '../lib/calendar-search';
import { agendaMove, viewDays } from '../lib/calendar-view';

describe('the days each view draws', () => {
  it('draws the Monday-to-Sunday week holding the anchor, across a month end', () => {
    // A week that started on the wrong day, or stopped at the month, would hide a day's events.
    expect(viewDays('week', '2026-11-01', '2026-11')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });

  it('draws the anchor alone on Day and the month whole weeks on Month', () => {
    expect(viewDays('day', '2026-11-08', '2026-11')).toEqual(['2026-11-08']);
    const month = viewDays('month', '2026-11-08', '2026-11');
    expect([month[0], month.at(-1), month.length]).toEqual(['2026-10-26', '2026-12-06', 42]);
  });

  it('drops a view, a day or a time the address cannot hold, rather than failing the route', () => {
    expect(calendarSearchSchema.parse({ view: 'year', date: 'soon', at: '25:00' })).toEqual({
      view: undefined,
      date: undefined,
      at: undefined,
      month: undefined,
      off: undefined,
      event: undefined,
      google: undefined,
      day: undefined,
    });
  });
});

describe('a drop on Day or Week', () => {
  const event = { layer: 'events' as const, day: '2026-11-09', time: '10:00', end: '10:45' };

  it('moves a personal event to the half hour it lands on, keeping its length', () => {
    expect(agendaMove(event, { date: '2026-11-10', time: '14:30' })).toEqual({
      layer: 'events',
      input: { date: '2026-11-10', allDay: false, startTime: '14:30', endTime: '15:15' },
    });
  });

  it('gives an all-day event an hour when it is dropped on the hours', () => {
    const allDay = { ...event, time: null, end: null, allDay: true };
    expect(agendaMove(allDay, { date: '2026-11-09', time: '09:00' })?.input).toEqual({
      date: '2026-11-09',
      allDay: false,
      startTime: '09:00',
      endTime: '10:00',
    });
  });

  it('keeps a late drop inside the day, which the API refuses past midnight', () => {
    expect(agendaMove(event, { date: '2026-11-09', time: '23:30' })?.input).toMatchObject({
      startTime: '23:14',
      endTime: '23:59',
    });
  });

  it('makes a task due at the dropped time, and drops its time in All day', () => {
    const task = { layer: 'tasks' as const, day: '2026-11-09', time: null, end: null };
    expect(agendaMove(task, { date: '2026-11-11', time: '11:00' })).toEqual({
      layer: 'tasks',
      input: { dueDate: '2026-11-11', dueTime: '11:00' },
    });
    expect(
      agendaMove({ ...task, time: '11:00', end: '12:00' }, { date: '2026-11-11', time: null }),
    ).toEqual({ layer: 'tasks', input: { dueDate: '2026-11-11', dueTime: null } });
  });

  it('writes nothing for a Google event, an automation run, or a drop where it already is', () => {
    expect(
      agendaMove({ ...event, layer: 'google' }, { date: '2026-11-10', time: '09:00' }),
    ).toBeNull();
    expect(
      agendaMove({ ...event, layer: 'automations' }, { date: '2026-11-10', time: '09:00' }),
    ).toBeNull();
    expect(agendaMove(event, { date: '2026-11-09', time: '10:00' })).toBeNull();
  });
});

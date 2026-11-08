import { describe, expect, it } from 'vitest';
import { headerEyebrow, headerTitle } from '../lib/calendar-header';
import { calendarSearchSchema } from '../lib/calendar-search';
import { agendaMove, monthMove, step, viewDays } from '../lib/calendar-view';

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

describe('the month and the header', () => {
  it('moves an event or a task to another day on the month, and nothing else', () => {
    const event = { layer: 'events' as const, day: '2026-11-09', time: '10:00', end: '11:00' };
    expect(monthMove(event, '2026-11-12')).toEqual({
      layer: 'events',
      input: { date: '2026-11-12' },
    });
    expect(monthMove({ ...event, layer: 'tasks' }, '2026-11-12')).toEqual({
      layer: 'tasks',
      input: { dueDate: '2026-11-12' },
    });
    expect(monthMove(event, '2026-11-09')).toBeNull();
    expect(monthMove({ ...event, layer: 'google' }, '2026-11-12')).toBeNull();
  });

  it('steps a month on Month and a day or a week on the hours', () => {
    const at = { anchor: '2026-11-08', month: '2026-11' };
    expect(step('month', at, -1)).toEqual({ month: '2026-10' });
    expect(step('week', at, 1)).toEqual({ date: '2026-11-15' });
    expect(step('day', at, -1)).toEqual({ date: '2026-11-07' });
  });

  it('titles a week across two months short, and says Today only on today', () => {
    const week = {
      view: 'week' as const,
      anchor: '2026-11-01',
      month: '2026-11',
      range: { from: '2026-10-26', to: '2026-11-01' },
      today: '2026-11-08',
    };
    expect(headerTitle(week, 'en')).toMatch(/^Oct 26\s–\sNov 1$/);
    expect(headerEyebrow(week)).toEqual({
      key: 'calendar.header.weekNumber',
      values: { week: 44 },
    });
    const day = { ...week, view: 'day' as const, anchor: '2026-11-08' };
    expect(headerTitle(day, 'en')).toBe('Sunday, November 8');
    expect(headerEyebrow(day)).toEqual({ key: 'calendar.header.todayWeek', values: { week: 45 } });
    expect(headerEyebrow({ ...week, view: 'month' })).toEqual({
      key: 'calendar.header.weeks',
      values: { from: 44, to: 49 },
    });
  });
});

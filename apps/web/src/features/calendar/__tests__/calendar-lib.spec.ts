import { AutomationEntity, CalendarEventEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { automationItems, byDay, eventItems } from '../lib/calendar-items';
import { calendarSearchSchema, hiddenLayers, toggleLayer } from '../lib/calendar-search';

/** The rule is set in the reader's own zone, so its wall-clock time is the grid's. */
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function automation(
  status: 'active' | 'paused',
  frequency: 'daily' | 'hourly' | 'weekly',
  days?: number[],
) {
  return new AutomationEntity(
    'a-1',
    'p-1',
    'Nightly audit',
    true,
    status,
    null,
    null,
    null,
    {
      id: 'r-1',
      number: 1,
      hostId: 'h-1',
      agent: 'claude-code',
      model: null,
      permission: 'auto',
      effort: null,
      prompt: 'Audit.',
      repositories: [],
      createdAt: new Date('2026-10-01T00:00:00Z'),
    },
    [
      {
        source: 'schedule',
        id: 't-1',
        frequency,
        hour: 9,
        minute: 30,
        days,
        timezone: zone,
        nextFireAt: null,
      },
    ],
    null,
    null,
    3,
    0,
    [],
    new Date('2026-10-01T00:00:00Z'),
    new Date('2026-10-01T00:00:00Z'),
  );
}

describe('the layers in the address', () => {
  it('is a bare URL with every layer on, and lists only the ones switched off', () => {
    expect(toggleLayer(undefined, 'google')).toBe('google');
    expect(toggleLayer('google', 'tasks')).toBe('google,tasks');
    expect(toggleLayer('google', 'google')).toBeUndefined();
    expect([...hiddenLayers('tasks,nonsense')]).toEqual(['tasks']);
  });

  it('reads a month it cannot use as this month', () => {
    expect(calendarSearchSchema.parse({ month: '2026-13' }).month).toBeUndefined();
    expect(calendarSearchSchema.parse({ month: '2026-10' }).month).toBe('2026-10');
  });
});

describe('automation runs on the month', () => {
  it('places each run of a schedule on its day at its time', () => {
    const items = automationItems([automation('active', 'daily')], '2026-10-05', '2026-10-07');
    expect(items.map((item) => [item.day, item.time])).toEqual([
      ['2026-10-05', '09:30'],
      ['2026-10-06', '09:30'],
      ['2026-10-07', '09:30'],
    ]);
  });

  it('keeps to the rule’s days, and leaves off a paused automation and an hourly rule', () => {
    // 2026-10-05 is a Monday; 1 = Monday in the rule's vocabulary.
    expect(
      automationItems([automation('active', 'weekly', [1])], '2026-10-01', '2026-10-14').map(
        (i) => i.day,
      ),
    ).toEqual(['2026-10-05', '2026-10-12']);
    expect(automationItems([automation('paused', 'daily')], '2026-10-05', '2026-10-07')).toEqual(
      [],
    );
    expect(automationItems([automation('active', 'hourly')], '2026-10-05', '2026-10-07')).toEqual(
      [],
    );
  });
});

describe('a day’s items', () => {
  it('lists all-day items first, then by time', () => {
    const event = (id: string, allDay: boolean, start: string | null) =>
      new CalendarEventEntity(
        id,
        'personal',
        id,
        '',
        '2026-10-05',
        allDay,
        start,
        start ? '23:00' : null,
        true,
        null,
      );
    const day = byDay(
      eventItems(
        [event('late', false, '18:00'), event('all', true, null), event('early', false, '08:00')],
        'events',
      ),
    );
    expect(day.get('2026-10-05')?.map((item) => item.title)).toEqual(['all', 'early', 'late']);
  });
});

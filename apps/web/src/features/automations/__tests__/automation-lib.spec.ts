import { AutomationEntity, type AutomationTrigger } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import {
  draftOf,
  emptyDraft,
  fitCards,
  githubCard,
  scheduleCard,
  toCreateInput,
  toUpdateInput,
  withFrequency,
} from '../lib/automation-draft';
import { nextRunText, runState, sidebarMeta } from '../lib/automation-view';
import { age, countdown, dayOffset, localDate, shortWait } from '../lib/time';
import { automationTriggerText, daysText, scheduleText } from '../lib/trigger-text';

/**
 * The editor's draft, the words a trigger reads as, and what a row prints.
 * All pure: `now` and the zone are handed in, so none of this reads a clock.
 */

// Key plus arguments, so an assertion reads which string and with what.
const t = ((key: string, args?: Record<string, unknown>) =>
  args ? `${key}${JSON.stringify(args)}` : key) as unknown as TFunction;

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const NOW = Date.UTC(2026, 8, 28, 10, 0); // Mon 28 Sep 2026, 10:00Z

function automation(
  overrides: Partial<{
    status: 'active' | 'paused' | 'running';
    nextRunAt: Date | null;
    triggers: AutomationTrigger[];
    runCount: number;
  }> = {},
) {
  return new AutomationEntity(
    'a-1',
    'p-1',
    'Nightly audit',
    true,
    overrides.status ?? 'active',
    overrides.status === 'paused' ? new Date(NOW) : null,
    null,
    overrides.nextRunAt === undefined ? new Date(NOW + 3_600_000) : overrides.nextRunAt,
    {
      id: 'r-1',
      number: 1,
      hostId: 'h-1',
      agent: 'claude-code',
      model: null,
      permission: 'auto',
      effort: null,
      prompt: 'Audit.',
      repositories: [{ installationId: 'i-1', githubRepoId: '101', fullName: 'acme/mobile' }],
      createdAt: new Date(NOW),
    },
    overrides.triggers ?? [
      {
        source: 'schedule',
        id: 't-1',
        frequency: 'daily',
        hour: 9,
        minute: 0,
        timezone: zone,
        nextFireAt: null,
      },
    ],
    null,
    null,
    3,
    overrides.runCount ?? 0,
    [],
    new Date(NOW),
    new Date(NOW),
  );
}

describe('time', () => {
  it('counts down the way the frames do', () => {
    expect(countdown(14 * 3_600_000 + 56 * 60_000 + 54_000)).toBe('14h 56m 54s');
    expect(countdown(2 * 86_400_000 + 3 * 3_600_000 + 5 * 60_000)).toBe('2d 3h 05m');
    expect(countdown(4 * 60_000 + 7_000)).toBe('4m 07s');
    expect(shortWait(45 * 3_600_000)).toBe('45h');
    expect(shortWait(3 * 86_400_000)).toBe('3d');
    expect(age(30_000, t)).toBe('common.relative.now');
    expect(age(5 * 3_600_000, t)).toBe('common.relative.hour{"count":5}');
  });

  it('reads local days in a zone, across midnight', () => {
    // 23:30Z on the 27th is already the 28th in Madrid.
    const late = Date.UTC(2026, 8, 27, 23, 30);
    expect(localDate(late, 'Europe/Madrid')).toBe('2026-09-28');
    expect(localDate(late, 'UTC')).toBe('2026-09-27');
    expect(dayOffset(late + 3_600_000, late, 'UTC')).toBe(1);
  });
});

describe('trigger words', () => {
  it('says a schedule as a person would', () => {
    const rule = { frequency: 'weekly' as const, hour: 9, minute: 0, days: [1, 3], timezone: zone };
    expect(scheduleText(rule, 'en', t)).toBe(
      'automations.trigger.weekly{"days":"Mon, Wed","time":"09:00"}',
    );
    expect(daysText([5, 1, 2, 3, 4], 'en', t)).toBe('automations.trigger.monFri');
    expect(daysText([0, 6], 'en', t)).toBe('automations.trigger.weekend');
  });

  it('names a zone that is not the viewer’s after the time', () => {
    const elsewhere = zone === 'Asia/Tokyo' ? 'Europe/Madrid' : 'Asia/Tokyo';
    const text = scheduleText(
      { frequency: 'daily', hour: 9, minute: 0, timezone: elsewhere },
      'en',
      t,
    );
    expect(text).toMatch(/"time":"09:00 \S+"/);
  });

  it('prints the first trigger and how many more there are', () => {
    const [first] = automation().triggers;
    const two = automation({
      triggers: [
        first as AutomationTrigger,
        {
          source: 'github',
          id: 't-2',
          event: 'pr_opened',
          repositories: ['101'],
          filter: { op: 'any' },
        },
      ],
    });
    expect(automationTriggerText(two, 'en', t)).toBe(
      'automations.trigger.more{"summary":"automations.trigger.daily{\\"time\\":\\"09:00\\"}","count":1}',
    );
    expect(automationTriggerText(automation({ triggers: [] }), 'en', t)).toBe(
      'automations.trigger.manual',
    );
  });
});

describe('rows', () => {
  it('reads the next run, a dash while paused, and the next event for a listener', () => {
    expect(nextRunText(automation({ status: 'paused' }), NOW, 'en', t)).toBe(
      'automations.next.none',
    );
    const listener = automation({
      nextRunAt: null,
      triggers: [
        { source: 'github', id: 'g', event: 'push', repositories: ['101'], filter: { op: 'any' } },
      ],
    });
    expect(nextRunText(listener, NOW, 'en', t)).toBe('automations.next.onEvent');
  });

  it('gives the sidebar its one word', () => {
    expect(sidebarMeta(automation({ status: 'running' }), NOW, t)).toBe(
      'automations.sidebar.running',
    );
    expect(sidebarMeta(automation(), NOW, t)).toBe('automations.next.in{"time":"1h"}');
    expect(sidebarMeta(automation({ nextRunAt: null, runCount: 12 }), NOW, t)).toBe('12');
  });

  it('draws a run with the three glyphs it has', () => {
    expect(runState('queued')).toBe('running');
    expect(runState('expired')).toBe('failed');
    expect(runState('completed')).toBe('completed');
  });
});

describe('the draft', () => {
  it('keeps only the fields a frequency reads, and keeps the time', () => {
    const card = scheduleCard('weekly', NOW, 'UTC');
    expect(card).toMatchObject({ frequency: 'weekly', hour: 9, minute: 0, days: [1] });
    const monthly = withFrequency({ ...card, hour: 7 }, 'monthly', NOW);
    expect(monthly).toMatchObject({ frequency: 'monthly', hour: 7, dayOfMonth: 1 });
    expect('days' in monthly).toBe(false);
    expect(withFrequency(card, 'once', NOW).date).toBe('2026-09-29');
  });

  it('starts a GitHub card on its event’s default filter, on every repository', () => {
    expect(githubCard('pr_opened', [101, 202])).toMatchObject({
      repositories: [101, 202],
      filter: { op: 'equals', value: 'main' },
    });
    expect(githubCard('issue_opened', [101]).filter).toEqual({ op: 'any' });
  });

  it('keeps each card inside the automation’s repositories', () => {
    const card = githubCard('push', [101, 202]);
    expect(fitCards([card], [202])[0]).toMatchObject({ repositories: [202] });
    expect(fitCards([githubCard('push', [101])], [303])[0]).toMatchObject({ repositories: [303] });
  });

  it('round-trips an automation into the requests the API takes', () => {
    const draft = draftOf(automation());
    const task = { name: 'Nightly audit', prompt: 'Audit.' };
    expect(toCreateInput(draft, task)).toMatchObject({
      projectId: 'p-1',
      hostId: 'h-1',
      repositories: [{ installationId: 'i-1', githubRepoId: 101 }],
      triggers: [{ source: 'schedule', frequency: 'daily', hour: 9 }],
    });
    expect(toCreateInput(draft, task)?.triggers[0]).not.toHaveProperty('key');
    // An edit sends the version it loaded, and no model clears the one it had.
    expect(toUpdateInput(draft, task, 3)).toMatchObject({ version: 3, launch: {} });
  });

  it('prefills a new automation from the project it was opened for', () => {
    const empty = emptyDraft([], [], undefined);
    expect(empty).toMatchObject({ projectId: null, hostId: null, agent: 'claude-code' });
    expect(toCreateInput(empty, { name: 'x', prompt: 'y' })).toBeNull();
  });
});

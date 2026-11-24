import type { BotRoutineEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { filterRoutines, routinesSearchSchema } from '../lib/routines-search';

/**
 * The Bot routines tab's filters live in the URL and narrow the whole list in
 * the browser. A value the URL carries that the schema does not accept reads
 * as the default, never as an error that fails the route; a pill's count says
 * what picking it would show under the other facets.
 */
describe('routinesSearchSchema', () => {
  it('keeps every facet', () => {
    expect(routinesSearchSchema.parse({ status: 'paused', bot: 'b1', trigger: 'gmail' })).toEqual({
      status: 'paused',
      bot: 'b1',
      trigger: 'gmail',
    });
  });

  it('reads a value it does not accept as absent', () => {
    expect(routinesSearchSchema.parse({ status: 'gone', bot: '', trigger: 'fax' })).toEqual({
      status: undefined,
      bot: undefined,
      trigger: undefined,
    });
  });
});

describe('filterRoutines', () => {
  const schedule = { source: 'schedule' } as const;
  const gmail = { source: 'gmail' } as const;
  const routines = [
    { id: 'r1', botId: 'mail', isPaused: false, triggers: [schedule] },
    { id: 'r2', botId: 'mail', isPaused: true, triggers: [gmail] },
    { id: 'r3', botId: 'ops', isPaused: true, triggers: [schedule, gmail] },
  ] as unknown as BotRoutineEntity[];

  it('narrows by bot, trigger and status together', () => {
    const { rows } = filterRoutines(routines, { status: 'paused', bot: null, trigger: 'gmail' });
    expect(rows.map((row) => row.id)).toEqual(['r2', 'r3']);
  });

  it('counts each pill under the other facets, a paused routine never active', () => {
    expect(
      filterRoutines(routines, { status: 'active', bot: 'mail', trigger: null }).counts,
    ).toEqual({ all: 2, active: 1, paused: 1 });
  });
});

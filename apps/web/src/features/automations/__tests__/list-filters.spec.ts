import type { BotRoutineEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { automationsSearchSchema } from '../lib/automations-search';
import { filterList, usedTriggerSources } from '../lib/list-filters';
import { routinesSearchSchema } from '../lib/routines-search';

/**
 * The Automations and Bot routines tabs keep their filters in the URL and
 * narrow the whole list in the browser. A value the URL carries that a schema
 * does not accept reads as the default, never as an error that fails the
 * route; a pill's count says what picking it would show under the other
 * facets.
 */
describe('the tabs’ search schemas', () => {
  it('keep every facet', () => {
    expect(routinesSearchSchema.parse({ status: 'paused', bot: 'b1', trigger: 'gmail' })).toEqual({
      status: 'paused',
      bot: 'b1',
      trigger: 'gmail',
    });
    expect(
      automationsSearchSchema.parse({ status: 'active', project: 'p1', trigger: 'github' }),
    ).toEqual({ status: 'active', project: 'p1', trigger: 'github' });
  });

  it('read a value they do not accept as absent', () => {
    const junk = { status: 'gone', bot: '', project: '', trigger: 'fax' };
    expect(routinesSearchSchema.parse(junk)).toEqual({
      status: undefined,
      bot: undefined,
      trigger: undefined,
    });
    expect(automationsSearchSchema.parse(junk)).toEqual({
      status: undefined,
      project: undefined,
      trigger: undefined,
    });
  });
});

describe('filterList', () => {
  const schedule = { source: 'schedule' } as const;
  const gmail = { source: 'gmail' } as const;
  const routines = [
    { id: 'r1', botId: 'mail', isPaused: false, triggers: [schedule] },
    { id: 'r2', botId: 'mail', isPaused: true, triggers: [gmail] },
    { id: 'r3', botId: 'ops', isPaused: true, triggers: [schedule, gmail] },
  ] as unknown as BotRoutineEntity[];
  const ownerOf = (routine: BotRoutineEntity) => routine.botId;

  it('narrows by owner, trigger and status together', () => {
    const { rows } = filterList(
      routines,
      { status: 'paused', owner: null, trigger: 'gmail' },
      ownerOf,
    );
    expect(rows.map((row) => row.id)).toEqual(['r2', 'r3']);
  });

  it('counts each pill under the other facets, a paused item never active', () => {
    expect(
      filterList(routines, { status: 'active', owner: 'mail', trigger: null }, ownerOf).counts,
    ).toEqual({ all: 2, active: 1, paused: 1 });
  });

  it('offers only the trigger sources some item uses, in the facet’s order', () => {
    expect(usedTriggerSources(routines)).toEqual(['schedule', 'gmail']);
  });
});

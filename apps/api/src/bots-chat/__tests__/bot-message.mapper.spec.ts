import { toSubagentRuns } from '../bot-message.mapper';

/**
 * The subagent runs a `delegate` step holds, read back from its column or
 * its call's JSON data: what the mapper wrote comes back whole, a field it
 * cannot read gets its default, a run with no task or a status it does not
 * know is dropped, and anything that is not a list reads as none rather
 * than failing the chat's read.
 */
describe('toSubagentRuns', () => {
  it('reads back the runs a step stored, and nothing from anything else', () => {
    const stored = [
      {
        task: 'a',
        status: 'completed',
        result: 'ok',
        toolCalls: ['list_hosts', 3],
        inputTokens: 5,
        outputTokens: -1,
        durationMs: 9.6,
      },
      { task: 'b', status: 'exploded' },
    ];
    const read = [
      {
        task: 'a',
        status: 'completed',
        result: 'ok',
        toolCalls: ['list_hosts'],
        inputTokens: 5,
        outputTokens: 0,
        durationMs: 10,
      },
    ];
    expect(toSubagentRuns(JSON.stringify(stored))).toEqual(read);
    expect(toSubagentRuns(stored)).toEqual(read);
    expect(toSubagentRuns(undefined)).toBeNull();
    expect(toSubagentRuns('{not json')).toBeNull();
  });
});

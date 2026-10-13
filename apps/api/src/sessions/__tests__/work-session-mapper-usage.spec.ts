import { SessionTurnOrmEntity } from '../database/session-turn.orm-entity';
import { WorkSessionMapper } from '../work-session.mapper';

/**
 * `pg` returns `bigint` and `numeric` as strings, so a token count read off
 * `session_turn` or summed by the usage aggregate arrives as text. The mapper
 * is the one place that turns it into a number; a miss here would hand Stats
 * `"941" + "2250"` concatenated instead of added. The SQL that produces these
 * rows is covered by `session-usage.integration.spec.ts`.
 */
const mapper = new WorkSessionMapper();

function storedTurn(overrides: Partial<SessionTurnOrmEntity> = {}): SessionTurnOrmEntity {
  return Object.assign(new SessionTurnOrmEntity(), {
    seq: 1,
    origin: 'automation',
    drive: 'headless',
    state: 'completed',
    prompt: 'Rename the flag',
    observedWorking: false,
    startedAt: new Date('2026-10-13T08:00:00Z'),
    endedAt: new Date('2026-10-13T08:05:00Z'),
    exitCode: 0,
    agentSessionId: null,
    result: null,
    failureDetail: null,
    costUsd: '0.183400',
    permissionDenials: 0,
    outputRef: null,
    model: 'claude-sonnet-4-5-20250929',
    inputTokens: '941',
    outputTokens: '2250',
    cacheReadTokens: '123456',
    cacheWriteTokens: '9876',
    ...overrides,
  });
}

describe('a stored turn’s usage', () => {
  it('reads bigint counts the driver returns as strings as numbers', () => {
    expect(mapper.turnToDomain(storedTurn())).toMatchObject({
      model: 'claude-sonnet-4-5-20250929',
      inputTokens: 941,
      outputTokens: 2250,
      cacheReadTokens: 123456,
      cacheWriteTokens: 9876,
      costUsd: 0.1834,
    });
  });

  it('keeps an unmeasured turn null rather than zero', () => {
    const turn = mapper.turnToDomain(
      storedTurn({
        model: null,
        inputTokens: null,
        outputTokens: null,
        cacheReadTokens: null,
        cacheWriteTokens: null,
      }),
    );
    expect(turn).toMatchObject({
      model: null,
      inputTokens: null,
      outputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
    });
  });

  it('reads a count past 2^53 as unmeasured instead of a rounded number', () => {
    expect(mapper.turnToDomain(storedTurn({ inputTokens: '9007199254740993' })).inputTokens).toBe(
      null,
    );
  });
});

describe('a row of the weekly usage aggregate', () => {
  it('reads numeric sums and the count as numbers', () => {
    expect(
      mapper.usageWeekToRead({
        weekStart: '2026-10-12',
        projectId: 'p-1',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: '941',
        outputTokens: '2250',
        cacheReadTokens: '123456',
        cacheWriteTokens: '9876',
        costUsd: '0.183400',
        turns: 2,
      }),
    ).toEqual({
      weekStart: '2026-10-12',
      projectId: 'p-1',
      model: 'claude-sonnet-4-5-20250929',
      inputTokens: 941,
      outputTokens: 2250,
      cacheReadTokens: 123456,
      cacheWriteTokens: 9876,
      costUsd: 0.1834,
      turns: 2,
    });
  });

  it('reads a group of unmeasured turns as zero usage under a null model', () => {
    expect(
      mapper.usageWeekToRead({
        weekStart: '2026-10-12',
        projectId: 'p-1',
        model: null,
        inputTokens: null,
        outputTokens: null,
        cacheReadTokens: null,
        cacheWriteTokens: null,
        costUsd: null,
        turns: 3,
      }),
    ).toMatchObject({ model: null, inputTokens: 0, outputTokens: 0, costUsd: 0, turns: 3 });
  });
});

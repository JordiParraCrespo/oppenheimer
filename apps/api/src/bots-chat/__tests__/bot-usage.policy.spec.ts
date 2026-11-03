/**
 * How a bot's usage is put together from its rows (`25-bots.md` §4.1,
 * `/usage`). What breaks this: a `bigint` sum read as a string and
 * concatenated, or a negative or missing count shown; `since` taken from a
 * later model's first turn; the models in the order the database answered.
 */
import { botUsageOf, tokenCount } from '../domain/bot-usage.policy';

const counts = (input: number, output: number) => ({
  inputTokens: input,
  outputTokens: output,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
});

describe('tokenCount', () => {
  it('reads a sum Postgres answered as a string, and nothing below zero', () => {
    expect(tokenCount('22800000')).toBe(22_800_000);
    expect(tokenCount(null)).toBe(0);
    expect(tokenCount(-3)).toBe(0);
    expect(tokenCount('not a number')).toBe(0);
  });
});

describe('botUsageOf', () => {
  it('sums the turns and their time, lists the models by spend and starts at the first turn', () => {
    const usage = botUsageOf({
      turns: [
        {
          provider: 'glm',
          model: 'glm-5.3',
          turns: 2,
          ...counts(100, 10),
          activeMs: 4_000,
          firstAt: new Date('2026-11-02T10:00:00Z'),
        },
        {
          provider: 'anthropic',
          model: 'claude-opus-5-5',
          turns: 3,
          ...counts(9_000, 900),
          activeMs: 60_000,
          firstAt: new Date('2026-11-01T09:00:00Z'),
        },
      ],
      background: [
        { purpose: 'summary', calls: 1, ...counts(5, 1) },
        { purpose: 'goal_review', calls: 4, ...counts(50, 4) },
      ],
    });
    expect(usage).toMatchObject({ since: '2026-11-01T09:00:00.000Z', turns: 5, activeMs: 64_000 });
    expect(usage.models.map((model) => model.model)).toEqual(['claude-opus-5-5', 'glm-5.3']);
    expect(usage.models[0]).not.toHaveProperty('firstAt');
    expect(usage.background.map((row) => row.purpose)).toEqual(['goal_review', 'summary']);
  });

  it('is an empty chat with no since before any turn ran', () => {
    expect(botUsageOf({ turns: [], background: [] })).toEqual({
      since: null,
      turns: 0,
      activeMs: 0,
      models: [],
      background: [],
    });
  });
});

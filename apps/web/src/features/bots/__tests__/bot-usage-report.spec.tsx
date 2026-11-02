import type { BotUsage } from '@oppenheimer/shared/schemas/bot';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotUsageReport } from '../components/bot-usage-report';

/**
 * The `/usage` card's figures (`25-bots.md` §4.1). What breaks this: the
 * Input line showing the cache's tokens twice; a model's breakdown or the
 * calls outside the turns left off the card; an empty chat drawing zeros
 * as if it had run.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; date?: string }) =>
      options?.count !== undefined ? `${key}:${options.count}` : key,
    i18n: { resolvedLanguage: 'en', language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

afterEach(cleanup);

const usage: BotUsage = {
  since: '2026-11-02T09:00:00.000Z',
  turns: 3,
  activeMs: 656_000,
  models: [
    {
      provider: 'anthropic',
      model: 'model-placeholder',
      turns: 3,
      inputTokens: 23_343_210,
      outputTokens: 1_900,
      cacheReadTokens: 22_800_000,
      cacheWriteTokens: 543_100,
    },
  ],
  background: [
    {
      purpose: 'goal_review',
      calls: 4,
      inputTokens: 4_000,
      outputTokens: 200,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
  ],
};

function report(value: BotUsage) {
  render(<BotUsageReport usage={value} context={null} fiveHour={null} sevenDay={null} />);
}

describe('BotUsageReport', () => {
  it('draws the chat’s figures, each model’s breakdown with the input apart from the cache, and the calls outside its turns', () => {
    report(usage);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('22.8M')).toBeTruthy();
    expect(screen.getByText('543.1K')).toBeTruthy();
    // 23,343,210 sent, of which 22,800,000 read and 543,100 written: 110 fresh.
    expect(screen.getByText('110')).toBeTruthy();
    expect(screen.getByText('model-placeholder')).toBeTruthy();
    expect(screen.getByText(/bots\.chat\.usage\.purpose\.goalReview/)).toBeTruthy();
    expect(screen.getByText(/bots\.chat\.usage\.calls:4/)).toBeTruthy();
    expect(screen.queryByText('bots.chat.usage.empty')).toBeNull();
  });

  it('says the chat has spent nothing before any turn ran, with no breakdown', () => {
    report({ since: null, turns: 0, activeMs: 0, models: [], background: [] });
    expect(screen.getByText('bots.chat.usage.empty')).toBeTruthy();
    expect(screen.queryByText('bots.chat.usage.breakdown')).toBeNull();
  });
});

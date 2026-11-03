import type { BotUsage } from '@oppenheimer/shared/schemas/bot';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotUsageReport } from '../components/bot-usage-report';

/**
 * The `/usage` card's lines (`25-bots.md` §4.1). What breaks this: the
 * Input figure counting the cache's tokens twice; the calls outside the
 * turns left out of the totals or not named; an empty chat drawing zeros as
 * if it had run; Close doing nothing.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options
        ? `${key}:${[
            options.count ?? options.tokens ?? options.calls,
            options.model,
            options.percent,
          ]
            .filter((value) => value !== undefined)
            .join(' ')}`
        : key,
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

function report(value: BotUsage, onClose = vi.fn()) {
  render(<BotUsageReport usage={value} onClose={onClose} />);
  return onClose;
}

describe('BotUsageReport', () => {
  it('says what the chat spent in three lines, the input apart from the cache, the calls outside its turns named', () => {
    const onClose = report(usage);
    expect(screen.getByText(/bots\.chat\.usage\.summary:3/)).toBeTruthy();
    // 23,343,210 + 4,000 sent, of which 22,800,000 read and 543,100 written: 4,110 fresh.
    expect(screen.getByText(/bots\.chat\.usage\.input:4\.1K/)).toBeTruthy();
    expect(screen.getByText(/bots\.chat\.usage\.cacheRead:22\.8M/)).toBeTruthy();
    expect(screen.getByText(/bots\.chat\.usage\.cacheWrite:543\.1K/)).toBeTruthy();
    expect(screen.getByText(/bots\.chat\.usage\.modelShare:model-placeholder 100/)).toBeTruthy();
    expect(screen.getByText(/bots\.chat\.usage\.includes/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('says the chat has spent nothing before any turn ran, with nothing to copy', () => {
    report({ since: null, turns: 0, activeMs: 0, models: [], background: [] });
    expect(screen.getByText('bots.chat.usage.empty')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'bots.chat.usage.copy' })).toBeNull();
  });
});

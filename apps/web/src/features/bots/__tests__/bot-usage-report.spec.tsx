import type { BotUsage } from '@oppenheimer/shared/schemas/bot';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotUsageReport } from '../components/bot-usage-report';

/**
 * The `/usage` card's figures (`25-bots.md` §4.1). What breaks this: the
 * Input line showing the cache's tokens twice; the calls outside the turns
 * left out of the breakdown or not named under it; an empty chat drawing
 * zeros as if it had run; Close doing nothing.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; date?: string; calls?: string }) =>
      options?.count !== undefined
        ? `${key}:${options.count}`
        : options?.calls !== undefined
          ? `${key}:${options.calls}`
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
  render(
    <BotUsageReport
      usage={value}
      context={null}
      fiveHour={null}
      sevenDay={null}
      onClose={onClose}
    />,
  );
  return onClose;
}

describe('BotUsageReport', () => {
  it('draws the chat’s figures and one breakdown of every token, the calls outside its turns named under it', () => {
    const onClose = report(usage);
    expect(screen.getByText('3')).toBeTruthy();
    // The turns' 22.8M read and the reviews' none: 22.8M.
    expect(screen.getByText('22.8M')).toBeTruthy();
    expect(screen.getByText('543.1K')).toBeTruthy();
    // 23,343,210 + 4,000 sent, of which 22,800,000 read and 543,100 written: 4,110 fresh.
    expect(screen.getByText('4.1K')).toBeTruthy();
    expect(screen.getAllByText('model-placeholder')).toHaveLength(2);
    expect(screen.getByText(/bots\.chat\.usage\.includes/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('says the chat has spent nothing before any turn ran, with no breakdown', () => {
    report({ since: null, turns: 0, activeMs: 0, models: [], background: [] });
    expect(screen.getByText('bots.chat.usage.empty')).toBeTruthy();
    expect(screen.queryByText('bots.chat.usage.breakdown')).toBeNull();
  });
});

import type { BotUsage } from '@oppenheimer/shared/schemas/bot';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotUsageReport } from '../components/bot-usage-report';

/**
 * The `/usage` card (`25-bots.md` §4.1). What breaks this: the Input line
 * counting the cache's tokens twice; the calls outside the turns left out of
 * the totals or not named; the plan's windows not drawn on a sign-in; an
 * empty chat drawing zeros as if it had run; Close doing nothing.
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
  render(<BotUsageReport usage={value} fiveHour={null} sevenDay={null} onClose={onClose} />);
  return onClose;
}

/** The figure or breakdown line a label names, as one row's text. */
function row(label: string) {
  return screen.getByText(label).parentElement?.textContent;
}

describe('BotUsageReport', () => {
  it('breaks the chat down with the input apart from the cache, the calls outside its turns named', () => {
    const onClose = report(usage);
    expect(row('bots.chat.usage.turns')).toBe('bots.chat.usage.turns3');
    // 22,800,000 read of 23,347,210 sent.
    expect(row('bots.chat.usage.cacheHit')).toBe('bots.chat.usage.cacheHit98%');
    // The one model: its share of the turns, and the breakdown's heading.
    expect(screen.getByText('100%').previousElementSibling?.textContent).toBe('model-placeholder');
    // 23,343,210 + 4,000 sent, of which 22,800,000 read and 543,100 written: 4,110 fresh.
    expect(row('bots.chat.usage.input')).toBe('bots.chat.usage.input4.1K');
    expect(row('bots.chat.usage.cacheRead')).toBe('bots.chat.usage.cacheRead22.8M');
    expect(row('bots.chat.usage.cacheWrite')).toBe('bots.chat.usage.cacheWrite543.1K');
    expect(screen.getByText(/bots\.chat\.usage\.includes/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it("draws the plan's windows a sign-in reported, and none it did not", () => {
    render(
      <BotUsageReport
        usage={usage}
        fiveHour={{ usedPercent: 34.4, resetsAt: null }}
        sevenDay={null}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('common.chat.usage.fiveHour')).toBeTruthy();
    expect(screen.getByText('34%')).toBeTruthy();
    expect(screen.queryByText('common.chat.usage.sevenDay')).toBeNull();
  });

  it('says the chat has spent nothing before any turn ran, with nothing to copy', () => {
    report({ since: null, turns: 0, activeMs: 0, models: [], background: [] });
    expect(screen.getByText('bots.chat.usage.empty')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'bots.chat.usage.copy' })).toBeNull();
  });
});

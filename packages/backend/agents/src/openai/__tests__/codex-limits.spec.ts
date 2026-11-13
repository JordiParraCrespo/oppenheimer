/**
 * The ChatGPT plan windows a bot's `/usage` card and meter draw, read off the
 * Codex backend's headers. Breaks when a placeholder window shows as 0% used
 * or a window lands in the wrong slot.
 */
import { describe, expect, it } from 'vitest';
import { codexLimitsOf } from '../codex-limits';

describe('codexLimitsOf', () => {
  it('leaves out a weekly window sent as 0% with no length and no reset', () => {
    const limits = codexLimitsOf(
      new Headers({
        'x-codex-primary-used-percent': '94',
        'x-codex-primary-window-minutes': '300',
        'x-codex-primary-reset-at': '1794000000',
        'x-codex-secondary-used-percent': '0',
      }),
    );
    expect(limits).toEqual({
      fiveHour: { usedPercent: 94, resetsAt: new Date(1_794_000_000_000) },
      sevenDay: null,
    });
  });

  it('keeps a weekly window at 0% when it has a reset', () => {
    const limits = codexLimitsOf(
      new Headers({
        'x-codex-secondary-used-percent': '0',
        'x-codex-secondary-window-minutes': '10080',
        'x-codex-secondary-reset-at': '1794500000',
      }),
    );
    expect(limits?.sevenDay).toEqual({ usedPercent: 0, resetsAt: new Date(1_794_500_000_000) });
  });

  it('places each window by its length, not by primary or secondary', () => {
    const limits = codexLimitsOf(
      new Headers({
        'x-codex-primary-used-percent': '12',
        'x-codex-primary-window-minutes': '10080',
        'x-codex-secondary-used-percent': '40',
        'x-codex-secondary-window-minutes': '300',
      }),
    );
    expect(limits?.fiveHour?.usedPercent).toBe(40);
    expect(limits?.sevenDay?.usedPercent).toBe(12);
  });

  it('reads primary as 5-hour and secondary as weekly when no length is sent', () => {
    const limits = codexLimitsOf(
      new Headers({
        'x-codex-primary-used-percent': '5',
        'x-codex-secondary-used-percent': '30',
      }),
    );
    expect(limits?.fiveHour?.usedPercent).toBe(5);
    expect(limits?.sevenDay?.usedPercent).toBe(30);
  });

  it('is none when the answer carries no window', () => {
    expect(codexLimitsOf(new Headers())).toBeNull();
  });
});

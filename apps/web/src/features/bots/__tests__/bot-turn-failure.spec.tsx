import { BotTurnEntity } from '@oppenheimer/frontend-consumer';
import type { BotTurnFailure as FailureKind } from '@oppenheimer/shared/schemas/bot';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotTurnFailure } from '../components/bot-turn-failure';

/**
 * A failed turn says whether sending it again can help, from the kind the
 * API recorded (`25-bots.md` §2). What breaks this: Retry offered where it
 * cannot succeed (a refused key, a spent quota), so the person retries into
 * the same wall; no way to Model providers from a refused key; or a turn
 * from before kinds were recorded drawing nothing.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

const failed = (failure: FailureKind | null) =>
  new BotTurnEntity(
    't1',
    'failed',
    'anthropic',
    'm',
    'upstream said no',
    0,
    0,
    false,
    new Date(),
    new Date(),
    new Date(),
    null,
    null,
    failure,
  );

function draw(failure: FailureKind | null) {
  const onRetry = vi.fn();
  const onOpenProviders = vi.fn();
  render(
    <BotTurnFailure
      turn={failed(failure)}
      onRetry={onRetry}
      retrying={false}
      onOpenProviders={onOpenProviders}
    />,
  );
  return { onRetry, onOpenProviders };
}

describe('BotTurnFailure', () => {
  it('offers Retry for a failure that passes, and says it usually does', () => {
    const { onRetry } = draw('rate_limit');
    expect(screen.getByText('bots.chat.failure.rate_limit')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'bots.chat.openProviders' })).toBeNull();
  });

  it('points a refused key at Model providers instead of Retry', () => {
    const { onOpenProviders } = draw('credential');
    expect(screen.queryByRole('button', { name: 'bots.chat.retry' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.openProviders' }));
    expect(onOpenProviders).toHaveBeenCalledOnce();
  });

  it.each(['usage_limit', 'refused', 'time_limit'] as const)(
    'offers no Retry for %s, which the same message meets again',
    (kind) => {
      draw(kind);
      expect(screen.getByText(`bots.chat.failure.${kind}`)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'bots.chat.retry' })).toBeNull();
    },
  );

  it('reads a turn that failed before kinds were recorded as the general failure, with Retry', () => {
    draw(null);
    expect(screen.getByText('bots.chat.failed')).toBeTruthy();
    expect(screen.getByText('upstream said no')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'bots.chat.retry' })).toBeTruthy();
  });
});

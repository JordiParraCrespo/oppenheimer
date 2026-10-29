import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotTurnLive } from '../components/bot-turn-live';

/**
 * The live line while the engine waits out a refused call. What breaks this:
 * the line saying "Thinking" for the minutes a provider's backoff takes, so
 * the person cannot tell a slow model from a rate limit.
 */

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (key: string, values?: { provider?: string }) =>
      values?.provider ? `${key}|${values.provider}` : key,
  }),
}));

afterEach(cleanup);

const line = (props: Partial<Parameters<typeof BotTurnLive>[0]>) =>
  render(
    <BotTurnLive
      queued={false}
      step={undefined}
      writing={false}
      provider="Anthropic"
      since={null}
      {...props}
    />,
  );

describe('BotTurnLive', () => {
  it('says the provider is limiting requests while the engine waits on it', () => {
    line({ waitingOn: 'rate_limit' });
    expect(screen.getByText('bots.chat.turn.retrying.rate_limit|Anthropic')).toBeTruthy();
  });

  it('says Thinking once it no longer waits', () => {
    line({});
    expect(screen.getByText('bots.chat.turn.thinking')).toBeTruthy();
  });
});

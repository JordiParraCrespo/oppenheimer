import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotActivity } from '../components/bot-activity';
import { ToolCallsShownContext } from '../hooks/use-tool-calls-shown';

/**
 * A run of tool calls with the chat's tool calls hidden. What breaks this:
 * the hidden trace still drawn, or hiding it taking the way into a session
 * a call started with it, so the reader has to show every call again to
 * reach that session.
 */

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en' } }),
}));

afterEach(cleanup);

const SESSION = '0b6c3f0e-5a7d-4c1e-9f2a-1d2e3f4a5b6c';

const step = (callId: string, overrides: Partial<BotToolStep> = {}): BotToolStep => ({
  callId,
  name: 'start_session',
  input: {},
  output: 'The agent is on it.',
  isError: false,
  sessionId: null,
  subagents: null,
  allowedBy: null,
  mailDraft: null,
  rateLimit: null,
  ...overrides,
});

describe('BotActivity with tool calls hidden', () => {
  it('drops the trace and keeps Open session for the session a call started', () => {
    render(
      <ToolCallsShownContext value={false}>
        <BotActivity
          steps={[
            step('a', { sessionId: SESSION }),
            step('b', { name: 'get_session', sessionId: SESSION }),
          ]}
        />
      </ToolCallsShownContext>,
    );
    expect(screen.queryByRole('list')).toBeNull();
    const [link, ...more] = screen.getAllByRole('link', { name: /bots\.chat\.openSession/ });
    expect(more).toHaveLength(0);
    expect(link?.getAttribute('href')).toBe(`/sessions/${SESSION}`);
  });

  it('draws nothing for calls that made nothing to keep', () => {
    const { container } = render(
      <ToolCallsShownContext value={false}>
        <BotActivity steps={[step('a', { name: 'list_hosts' })]} />
      </ToolCallsShownContext>,
    );
    expect(container.innerHTML).toBe('');
  });
});

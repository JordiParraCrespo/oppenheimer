import { BotMessageEntity, BotTurnEntity } from '@oppenheimer/frontend-consumer';
import type { BotTurnStatus } from '@oppenheimer/shared/schemas/bot';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotTurn } from '../components/bot-turn';
import { ToolCallsShownContext } from '../hooks/use-tool-calls-shown';
import type { ChatTurnBlock } from '../lib/chat-turns';

/**
 * A turn's trail while the chat hides its tool calls. What breaks this: a
 * finished turn that only ran tools still trailing its model and time, so
 * hiding them leaves a column of model names; or the hiding swallowing a
 * stopped turn's Stopped and Retry, or the newest turn's Retry, so the
 * reader has to show every call again to send it once more.
 */

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en' } }),
}));

afterEach(cleanup);

const at = new Date('2026-11-10T08:00:00Z');

const turn = (status: BotTurnStatus) =>
  new BotTurnEntity('t1', status, 'glm', 'glm-5', null, 10, 5, false, at, at, at);

const ranTools = new BotMessageEntity(
  'a1',
  't1',
  'activity',
  '',
  [
    {
      callId: 'c1',
      name: 'list_hosts',
      input: {},
      output: '[]',
      isError: false,
      sessionId: null,
      subagents: null,
      allowedBy: null,
      mailDraft: null,
      rateLimit: null,
    },
  ],
  at,
);

function draw(status: BotTurnStatus, answer: BotMessageEntity[], onRetry?: () => void) {
  const block: ChatTurnBlock = { key: 't1', turnId: 't1', turn: turn(status), asked: [], answer };
  render(
    <ToolCallsShownContext value={false}>
      <BotTurn
        block={block}
        live={undefined}
        current
        subagents={{}}
        images={() => null}
        onRetry={onRetry}
      />
    </ToolCallsShownContext>,
  );
}

describe('BotTurn with tool calls hidden', () => {
  it('trails nothing under a finished turn that only ran tools', () => {
    draw('completed', [ranTools]);
    expect(screen.queryByText(/glm-5/)).toBeNull();
  });

  it('keeps Retry, without the model, on the newest such turn', () => {
    draw('completed', [ranTools], () => {});
    expect(screen.getByRole('button', { name: 'bots.chat.retry' })).toBeTruthy();
    expect(screen.queryByText(/glm-5/)).toBeNull();
  });

  it('keeps Stopped and Retry on a turn stopped before it said anything', () => {
    draw('cancelled', [], () => {});
    expect(screen.getByText(/bots\.chat\.turn\.stopped/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'bots.chat.retry' })).toBeTruthy();
  });
});

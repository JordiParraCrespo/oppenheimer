import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { botDraft, setBotDraft } from '../lib/bot-drafts';
import { BotComposer } from '../sections/bot-composer';

/**
 * Writing to a bot while it works. What breaks this: the box stuck on Stop
 * while something is written, so nothing can be sent until the turn ends; a
 * waiting message whose Remove or Edit calls off another turn, or whose Edit
 * loses its words; Send now offered on a message that is not next, or on one
 * whose images the field could not hold again.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

vi.mock('@oppenheimer/frontend-core/react', () => ({
  useErrorMessage: () => (_error: unknown, fallback: string) => ({ message: fallback }),
}));

const state = vi.hoisted(() => ({
  send: vi.fn(),
  cancel: vi.fn((_input: unknown, options?: { onSuccess?: () => void }) => options?.onSuccess?.()),
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useBotActiveTurn: () => ({ id: 'run', status: 'running' }),
  useBotGoal: () => ({ data: null }),
  useBotWaitingMessages: () => [
    { turnId: 'q1', text: 'Then the tests', images: 0 },
    { turnId: 'q2', text: '', images: 2 },
  ],
  useModelProviders: () => ({ data: true }),
  useSendBotMessage: () => ({ mutate: state.send, reset: vi.fn(), error: null, isPending: false }),
  useUploadBotImage: () => ({ mutateAsync: vi.fn() }),
  useCancelBotTurn: () => ({ mutate: state.cancel, reset: vi.fn(), error: null, isPending: false }),
  useVoiceDictation: () => ({ available: false, transcribe: async () => null }),
  useBotSlashCommands: () => ({ data: undefined }),
}));

beforeEach(() => setBotDraft('b1', ''));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function composer() {
  render(
    <BotComposer
      botId="b1"
      name="Ada"
      provider="anthropic"
      model={null}
      tools={null}
      engine={null}
    />,
  );
}

describe('BotComposer while the bot works', () => {
  it('turns Stop into Send once something is written, and sends it to wait its turn', () => {
    composer();
    expect(screen.getByRole('button', { name: 'bots.chat.stop' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'And a pull request' } });
    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.send' }));
    expect(state.send).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b1', content: 'And a pull request' }),
    );
  });

  it('shows each waiting message, images alone by their count', () => {
    composer();
    expect(screen.getByText('Then the tests')).toBeTruthy();
    expect(screen.getByText('bots.chat.queuedImages:2')).toBeTruthy();
  });

  it('sends the next one now by stopping the turn under way', () => {
    composer();
    const sendNow = screen.getAllByRole('button', { name: 'common.chat.queue.sendNow' });
    expect(sendNow).toHaveLength(1);
    fireEvent.click(sendNow[0] as HTMLElement);
    expect(state.cancel).toHaveBeenCalledWith({ id: 'b1', turnId: 'run' });
  });

  it('takes a message back into the field to edit, and offers no edit for one with images', () => {
    setBotDraft('b1', 'half a thought');
    composer();
    const edit = screen.getAllByRole('button', { name: 'common.chat.queue.edit' });
    expect(edit).toHaveLength(1);
    fireEvent.click(edit[0] as HTMLElement);
    expect(state.cancel).toHaveBeenCalledWith(
      { id: 'b1', turnId: 'q1' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(botDraft('b1')).toBe('Then the tests\nhalf a thought');
  });

  it('removes a waiting message by calling off its own turn', () => {
    composer();
    const remove = screen.getAllByRole('button', { name: 'common.chat.queue.remove' });
    fireEvent.click(remove[1] as HTMLElement);
    expect(state.cancel).toHaveBeenCalledWith({ id: 'b1', turnId: 'q2' });
  });
});

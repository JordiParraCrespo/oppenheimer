import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { botDraft, setBotDraft } from '../lib/bot-drafts';
import { BotComposer } from '../sections/bot-composer';

/**
 * Writing to a bot while it works. What breaks this: the box stuck on Stop
 * while something is written, so nothing can be sent until the turn ends; a
 * waiting message whose Remove or Edit calls off another turn, or whose Edit
 * loses its words; Send now offered on a message that is not next, or on one
 * whose images the field could not hold again; Enter that queues instead of
 * steering the turn under way, Alt+Enter that steers instead of queueing, a
 * steer shown as if it waited for after; Escape that does not stop the turn,
 * or that stops it while a menu or dialog open over the chat wanted the key,
 * or, beside a session, while the key was the session's.
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
  useBotLoop: () => ({ data: null }),
  useBotSuggestion: () => null,
  useBotWaitingMessages: () => [
    { turnId: 'q1', text: 'Then the tests', images: 0, steer: false },
    { turnId: 'q2', text: '', images: 2, steer: false },
    { turnId: 's1', text: 'Skip the docs', images: 0, steer: true },
  ],
  useBotSentTexts: () => [],
  useModelProviders: () => ({ data: true }),
  useSendBotMessage: () => ({ mutate: state.send, reset: vi.fn(), error: null, isPending: false }),
  useUploadBotImage: () => ({ mutateAsync: vi.fn() }),
  useCancelBotTurn: () => ({ mutate: state.cancel, reset: vi.fn(), error: null, isPending: false }),
  useClearBotLoop: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useClearBotGoal: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useResumeBotGoal: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useVoiceDictation: () => ({ available: false, transcribe: async () => null }),
  useBotSlashCommands: () => ({ data: undefined }),
}));

beforeEach(() => setBotDraft('b1', ''));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function composer(dropsOn: 'pane' | 'box' = 'pane') {
  render(
    <BotComposer
      dropsOn={dropsOn}
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
  it('turns Stop into Send once something is written, and steers the turn under way with it', () => {
    composer();
    expect(screen.getByRole('button', { name: 'bots.chat.stop' })).toBeTruthy();
    expect(screen.getByPlaceholderText('bots.chat.placeholderRunning')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'And a pull request' } });
    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.send' }));
    expect(state.send).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b1', content: 'And a pull request', steer: true }),
    );
  });

  it('steers on Enter and queues for after on Alt+Enter', () => {
    composer();
    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'Use Tokyo time' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(state.send).toHaveBeenLastCalledWith(expect.objectContaining({ steer: true }));
    fireEvent.change(field, { target: { value: 'Use Tokyo time' } });
    fireEvent.keyDown(field, { key: 'Enter', altKey: true });
    expect(state.send).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: 'Use Tokyo time', steer: false }),
    );
    expect(state.send).toHaveBeenCalledTimes(2);
  });

  it('marks a waiting steer as one, apart from the messages queued for after', () => {
    composer();
    expect(screen.getAllByText('common.chat.queue.queued')).toHaveLength(2);
    expect(screen.getAllByText('common.chat.queue.steer')).toHaveLength(1);
    expect(screen.getByText('Skip the docs')).toBeTruthy();
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
    // The words-only queued message and the steer; not the one with images.
    expect(edit).toHaveLength(2);
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

  it('stops the turn under way on Escape, from the field or anywhere in the chat', () => {
    composer();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(state.cancel).toHaveBeenCalledWith({ id: 'b1', turnId: 'run' });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(state.cancel).toHaveBeenCalledTimes(2);
  });

  it('leaves Escape to a menu or dialog open over the chat', () => {
    composer();
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    document.body.append(menu);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    menu.remove();
    fireEvent.keyDown(document.body, { key: 'Escape', ctrlKey: true });
    expect(state.cancel).not.toHaveBeenCalled();
  });

  it('leaves Escape to the `/` menu, which closes on it', () => {
    composer();
    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: '/' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(state.cancel).not.toHaveBeenCalled();
    // The menu shut, the next Escape is the composer's again.
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(state.cancel).toHaveBeenCalledTimes(1);
  });

  it('leaves Escape to an input method dismissing its candidates in the field', () => {
    composer();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape', isComposing: true });
    expect(state.cancel).not.toHaveBeenCalled();
  });

  it('beside a session, leaves Escape on the session to it and stops only from its own box', () => {
    composer('box');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(state.cancel).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('button', { name: 'bots.chat.stop' }), { key: 'Escape' });
    expect(state.cancel).toHaveBeenCalledWith({ id: 'b1', turnId: 'run' });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(state.cancel).toHaveBeenCalledTimes(2);
  });

  it('leaves Escape to another field, such as the sidebar search clearing itself', () => {
    composer();
    const search = document.createElement('input');
    document.body.append(search);
    fireEvent.keyDown(search, { key: 'Escape' });
    search.remove();
    expect(state.cancel).not.toHaveBeenCalled();
  });
});

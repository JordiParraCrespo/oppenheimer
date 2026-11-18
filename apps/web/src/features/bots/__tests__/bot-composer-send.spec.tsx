import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBotDraft } from '../lib/bot-drafts';
import { BotComposer } from '../sections/bot-composer';

/**
 * Sending from the bot composer is optimistic: the field empties the moment
 * you send, while the chat draws the message. What breaks this: words that
 * sit in the field until the API answers, or a refused send that loses what
 * was written and the images it carried.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

vi.mock('@oppenheimer/frontend-core/react', () => ({
  useErrorMessage: () => (_error: unknown, fallback: string) => ({ message: fallback }),
}));

const state = vi.hoisted(() => ({
  send: vi.fn(),
  upload: vi.fn(),
  options: null as null | { onError: (error: Error, sent: unknown) => void },
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useBotActiveTurn: () => null,
  useBotWaitingMessages: () => [],
  useBotSentTexts: () => [],
  useBotGoal: () => ({ data: null }),
  useBotLoop: () => ({ data: null }),
  useModelProviders: () => ({ data: true }),
  useSendBotMessage: (options: { onError: (error: Error, sent: unknown) => void }) => {
    state.options = options;
    return { mutate: state.send, reset: vi.fn(), error: null, isPending: false };
  },
  useUploadBotImage: () => ({ mutateAsync: state.upload }),
  useCancelBotTurn: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useClearBotLoop: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useClearBotGoal: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useResumeBotGoal: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useVoiceDictation: () => ({ available: false, transcribe: async () => null }),
  useBotSlashCommands: () => ({ data: undefined }),
}));

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  setBotDraft('b1', '');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function composer(provider: 'anthropic' | 'glm' = 'anthropic') {
  render(
    <BotComposer
      botId="b1"
      name="Ada"
      provider={provider}
      model={null}
      tools={null}
      engine={null}
    />,
  );
  return screen.getByRole('textbox') as HTMLTextAreaElement;
}

const png = () => new File(['png'], 'shot.png', { type: 'image/png' });
const sendButton = () => screen.getByRole('button', { name: 'bots.chat.send' });

describe('BotComposer send', () => {
  it('empties the field at once, before the API answers', () => {
    const field = composer();
    fireEvent.change(field, { target: { value: 'Ship it' } });

    fireEvent.click(sendButton());

    expect(state.send).toHaveBeenCalledWith(expect.objectContaining({ content: 'Ship it' }));
    expect(field.value).toBe('');
  });

  it('puts the words and the images back when the API refuses the send', async () => {
    state.upload.mockResolvedValue({
      id: 'a1',
      mimeType: 'image/png',
      sizeBytes: 3,
      name: 'shot.png',
    });
    const field = composer();
    fireEvent.change(field, { target: { value: 'Look' } });
    fireEvent.paste(field, { clipboardData: { files: [png()] } });
    await waitFor(() => expect(sendButton().getAttribute('aria-disabled')).not.toBe('true'));

    fireEvent.click(sendButton());
    expect(field.value).toBe('');
    expect(screen.queryByRole('img', { name: 'shot.png' })).toBeNull();

    const sent = state.send.mock.calls[0]?.[0];
    act(() => state.options?.onError(new Error('BOTS_001'), sent));
    expect(field.value).toBe('Look');
    expect(screen.getByRole('img', { name: 'shot.png' })).toBeTruthy();
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBotDraft } from '../lib/bot-drafts';
import { BotComposer } from '../sections/bot-composer';

/**
 * Images in the bot composer. What breaks this: a pasted image that is not
 * uploaded, or sent without its upload's id; a message of images alone that
 * cannot be sent; an image held for a model that reads none, or a refused
 * upload, sent anyway or losing what was written.
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
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useBotActiveTurn: () => null,
  useBotWaitingMessages: () => [],
  useBotGoal: () => ({ data: null }),
  useModelProviders: () => ({ data: true }),
  useSendBotMessage: () => ({ mutate: state.send, reset: vi.fn(), error: null, isPending: false }),
  useUploadBotImage: () => ({ mutateAsync: state.upload }),
  useCancelBotTurn: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useVoiceDictation: () => ({ available: false, transcribe: async () => null }),
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

function paste(field: HTMLElement, ...files: File[]) {
  fireEvent.paste(field, { clipboardData: { files } });
}

const png = (name = 'shot.png') => new File(['png'], name, { type: 'image/png' });
const sendButton = () => screen.getByRole('button', { name: 'bots.chat.send' });

describe('BotComposer images', () => {
  it('uploads a pasted image at once and sends its id with the message, words or none', async () => {
    state.upload.mockResolvedValue({
      id: 'a1',
      mimeType: 'image/png',
      sizeBytes: 3,
      name: 'shot.png',
    });
    const field = composer();

    paste(field, png());

    expect(state.upload).toHaveBeenCalledWith({ id: 'b1', file: expect.any(File) });
    expect(screen.getByRole('img', { name: 'shot.png' })).toBeTruthy();
    await waitFor(() => expect(sendButton().getAttribute('aria-disabled')).not.toBe('true'));
    fireEvent.click(sendButton());
    expect(state.send).toHaveBeenCalledWith({
      id: 'b1',
      content: '',
      attachmentIds: ['a1'],
      steer: false,
    });
  });

  it('takes an image off the message with its cross', async () => {
    state.upload.mockResolvedValue({
      id: 'a1',
      mimeType: 'image/png',
      sizeBytes: 3,
      name: 'shot.png',
    });
    paste(composer(), png());
    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.images.remove' }));
    expect(screen.queryByRole('img', { name: 'shot.png' })).toBeNull();
  });

  it('refuses images for a model that reads none, uploading nothing and keeping the words', () => {
    const field = composer('glm');
    fireEvent.change(field, { target: { value: 'What is this?' } });

    paste(field, png());

    expect(state.upload).not.toHaveBeenCalled();
    expect(screen.getByText('bots.chat.images.noVision')).toBeTruthy();
    expect(field.value).toBe('What is this?');
  });

  it('keeps send off while an upload the API refused is held, and says why', async () => {
    state.upload.mockRejectedValue(new Error('BOTS_024'));
    const field = composer();
    fireEvent.change(field, { target: { value: 'Look' } });

    paste(field, png('notes.png'));

    expect(await screen.findByText('bots.chat.images.uploadFailed')).toBeTruthy();
    expect(sendButton().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(sendButton());
    expect(state.send).not.toHaveBeenCalled();
    expect(field.value).toBe('Look');
  });
});

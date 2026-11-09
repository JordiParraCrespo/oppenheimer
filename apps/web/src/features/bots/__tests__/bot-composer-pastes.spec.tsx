import { BOT_MESSAGE_MAX } from '@oppenheimer/shared/schemas/bot';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBotDraft } from '../lib/bot-drafts';
import { setBotPastes } from '../lib/bot-pastes';
import { BotComposer } from '../sections/bot-composer';

/**
 * Long pastes in the bot composer, held as Claude Code and Codex hold them.
 * What breaks this: a long paste that floods the field instead of becoming
 * its label, a message sent with the label in place of the pasted text, a
 * label Backspace takes apart a character at a time, or a message longer
 * than a bot takes that send lets through for the API to refuse.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key === 'bots.chat.pasted.lines'
        ? `[Pasted text #${values?.n} +${values?.lines} lines]`
        : key === 'bots.chat.pasted.chars'
          ? `[Pasted text #${values?.n} ${values?.chars} chars]`
          : key,
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

vi.mock('@oppenheimer/frontend-core/react', () => ({
  useErrorMessage: () => (_error: unknown, fallback: string) => ({ message: fallback }),
}));

const state = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useBotActiveTurn: () => null,
  useBotWaitingMessages: () => [],
  useBotSentTexts: () => [],
  useBotGoal: () => ({ data: null }),
  useBotLoop: () => ({ data: null }),
  useModelProviders: () => ({ data: true }),
  useSendBotMessage: () => ({ mutate: state.send, reset: vi.fn(), error: null, isPending: false }),
  useUploadBotImage: () => ({ mutateAsync: vi.fn() }),
  useCancelBotTurn: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useClearBotLoop: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useClearBotGoal: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useResumeBotGoal: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useVoiceDictation: () => ({ available: false, transcribe: async () => null }),
  useBotSlashCommands: () => ({ data: undefined }),
}));

beforeEach(() => {
  setBotDraft('b1', '');
  setBotPastes('b1', []);
});

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
  return screen.getByRole('textbox') as HTMLTextAreaElement;
}

/** Whether the browser was left to paste it, as itself. */
function pasteText(field: HTMLTextAreaElement, text: string): boolean {
  return fireEvent.paste(field, { clipboardData: { files: [], getData: () => text } });
}

const log = Array.from({ length: 1000 }, (_, line) => `line ${line + 1}`).join('\n');
const sendButton = () => screen.getByRole('button', { name: 'bots.chat.send' });

describe('BotComposer long pastes', () => {
  it('holds a long paste as its label at the caret and sends the pasted text in its place', () => {
    const field = composer();
    fireEvent.change(field, { target: { value: 'Why does this fail? ' } });
    field.setSelectionRange(field.value.length, field.value.length);

    pasteText(field, log);

    expect(field.value).toBe('Why does this fail? [Pasted text #1 +1000 lines]');
    fireEvent.click(sendButton());
    expect(state.send).toHaveBeenCalledWith(
      expect.objectContaining({ content: `Why does this fail? ${log}` }),
    );
  });

  it('numbers a second paste and leaves a short one to the browser', () => {
    const field = composer();

    expect(pasteText(field, log)).toBe(false);
    expect(pasteText(field, 'x'.repeat(1500))).toBe(false);
    expect(pasteText(field, 'a few\nshort lines')).toBe(true);

    expect(field.value).toBe('[Pasted text #1 +1000 lines][Pasted text #2 1500 chars]');
  });

  it('takes a label out whole on Backspace, and its paste is not sent', () => {
    const field = composer();
    fireEvent.change(field, { target: { value: 'See ' } });
    field.setSelectionRange(4, 4);
    pasteText(field, log);

    fireEvent.keyDown(field, { key: 'Backspace' });

    expect(field.value).toBe('See ');
    fireEvent.click(sendButton());
    expect(state.send).toHaveBeenCalledWith(expect.objectContaining({ content: 'See ' }));
  });

  it('keeps send off for a message longer than a bot takes, and says why', () => {
    const field = composer();

    pasteText(field, 'y'.repeat(BOT_MESSAGE_MAX + 1));

    expect(sendButton().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(sendButton());
    expect(state.send).not.toHaveBeenCalled();
  });
});

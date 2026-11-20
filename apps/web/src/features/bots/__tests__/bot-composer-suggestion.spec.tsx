import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { botDraft, setBotDraft } from '../lib/bot-drafts';
import { BotComposer } from '../sections/bot-composer';

/**
 * The suggested next message, as Claude Code offers one: greyed out where
 * the placeholder is, and Tab writes it into the field. What breaks this:
 * the suggestion not shown, or shown over a draft; Tab doing nothing, or
 * sending it rather than filling the field; Tab taken from the page when
 * there is nothing to offer, or with a modifier; the suggestion read while
 * the bot is still working or the field holds words.
 */

const state = vi.hoisted(() => ({
  suggestion: 'yes, open the pull request' as string | null,
  active: null as { id: string; status: string } | null,
  asked: [] as boolean[],
  send: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en', language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

vi.mock('@oppenheimer/frontend-core/react', () => ({
  useErrorMessage: () => (_error: unknown, fallback: string) => ({ message: fallback }),
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useBotActiveTurn: () => state.active,
  useBotGoal: () => ({ data: null }),
  useBotLoop: () => ({ data: null }),
  useBotSuggestion: (_id: string, enabled: boolean) => {
    state.asked.push(enabled);
    return enabled ? state.suggestion : null;
  },
  useBotWaitingMessages: () => [],
  useBotSentTexts: () => [],
  useModelProviders: () => ({ data: true }),
  useSendBotMessage: () => ({ mutate: state.send, reset: vi.fn(), error: null, isPending: false }),
  useUploadBotImage: () => ({ mutateAsync: vi.fn() }),
  useCancelBotTurn: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useClearBotLoop: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useClearBotGoal: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useResumeBotGoal: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useVoiceDictation: () => ({ available: false, transcribe: async () => null }),
  useBotSlashCommands: () => ({ data: [] }),
}));

beforeEach(() => {
  setBotDraft('b1', '');
  state.suggestion = 'yes, open the pull request';
  state.active = null;
  state.asked = [];
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

const tab = (field: HTMLElement, init: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(field, { key: 'Tab', ...init });

describe('BotComposer’s suggested next message', () => {
  it('shows the suggestion greyed out in the empty field, and Tab writes it in without sending', () => {
    const field = composer();
    expect(field.placeholder).toBe('yes, open the pull request');
    const taken = !tab(field);
    expect(taken).toBe(true);
    expect(botDraft('b1')).toBe('yes, open the pull request');
    expect(state.send).not.toHaveBeenCalled();
  });

  it('leaves Tab to the page when there is no suggestion, or with a modifier', () => {
    state.suggestion = null;
    const field = composer();
    expect(field.placeholder).toBe('bots.chat.placeholder');
    expect(tab(field)).toBe(true);
    expect(botDraft('b1')).toBe('');
    cleanup();

    state.suggestion = 'yes';
    const again = composer();
    expect(tab(again, { shiftKey: true })).toBe(true);
    expect(botDraft('b1')).toBe('');
  });

  it('offers nothing over words already written', () => {
    const field = composer();
    fireEvent.change(field, { target: { value: 'no, wait' } });
    expect(state.asked.at(-1)).toBe(false);
    tab(field);
    expect(botDraft('b1')).toBe('no, wait');
  });

  it('does not ask for a suggestion while the bot is working', () => {
    state.active = { id: 't1', status: 'running' };
    const field = composer();
    expect(state.asked.every((enabled) => !enabled)).toBe(true);
    expect(field.placeholder).toBe('bots.chat.placeholderRunning');
  });
});

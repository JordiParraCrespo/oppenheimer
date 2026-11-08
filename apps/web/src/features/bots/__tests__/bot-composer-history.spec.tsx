import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { botDraft, setBotDraft } from '../lib/bot-drafts';
import { BotComposer } from '../sections/bot-composer';

/**
 * Up and Down bring back what you sent, as a shell does. What breaks this:
 * Up doing nothing on an empty field; Up skipping past the last message, or
 * stopping after one; Down not giving back the draft you had; the arrows
 * stealing the caret from a draft of several lines, from one long line the
 * field wraps, or from a recalled message you started editing; the draft you had lost once a
 * recalled message is edited, or a message written over a recalled one lost
 * on the next step; a send leaving the walk where it was.
 */

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
  useBotActiveTurn: () => null,
  useBotGoal: () => ({ data: null }),
  useBotLoop: () => ({ data: null }),
  useBotWaitingMessages: () => [],
  // Newest first, as the conversation hands them.
  useBotSentTexts: () => ['run the tests', 'fix the build\nthen push', 'hello'],
  useModelProviders: () => ({ data: true }),
  useSendBotMessage: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useUploadBotImage: () => ({ mutateAsync: vi.fn() }),
  useCancelBotTurn: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useClearBotLoop: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useClearBotGoal: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useVoiceDictation: () => ({ available: false, transcribe: async () => null }),
  useBotSlashCommands: () => ({ data: [] }),
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
  return screen.getByRole('textbox') as HTMLTextAreaElement;
}

const type = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } });
const up = (field: HTMLElement) => fireEvent.keyDown(field, { key: 'ArrowUp' });
const down = (field: HTMLElement) => fireEvent.keyDown(field, { key: 'ArrowDown' });
const caret = (field: HTMLTextAreaElement, at: number) => field.setSelectionRange(at, at);

describe('BotComposer’s sent history', () => {
  it('walks back through what was sent on Up, and forward to the draft on Down', () => {
    const field = composer();
    type(field, 'half');
    caret(field, 0);
    up(field);
    expect(botDraft('b1')).toBe('run the tests');
    up(field);
    expect(botDraft('b1')).toBe('fix the build\nthen push');
    // A recalled message of several lines still steps on, whatever line the caret is on.
    up(field);
    expect(botDraft('b1')).toBe('hello');
    up(field);
    expect(botDraft('b1')).toBe('hello');
    down(field);
    down(field);
    expect(botDraft('b1')).toBe('run the tests');
    down(field);
    expect(botDraft('b1')).toBe('half');
  });

  it('leaves the caret its arrows while writing several lines, or once a recalled message is edited', () => {
    const field = composer();
    type(field, 'one\ntwo');
    caret(field, 6);
    up(field);
    expect(botDraft('b1')).toBe('one\ntwo');
    type(field, '');
    up(field);
    up(field);
    expect(botDraft('b1')).toBe('fix the build\nthen push');
    type(field, 'fix the build\nthen push!');
    caret(field, 20);
    up(field);
    expect(botDraft('b1')).toBe('fix the build\nthen push!');
  });

  it('keeps the draft you had past the newest after a recalled message is edited, and starts over after a send', () => {
    const field = composer();
    type(field, 'please refactor the parser');
    caret(field, 0);
    up(field);
    type(field, 'run the tests!');
    down(field);
    expect(botDraft('b1')).toBe('please refactor the parser');
    up(field);
    fireEvent.keyDown(field, { key: 'Enter' });
    type(field, '');
    up(field);
    expect(botDraft('b1')).toBe('run the tests');
  });

  it('keeps what was written over a recalled message, and an edit, while stepping past them', () => {
    const field = composer();
    type(field, 'A');
    caret(field, 0);
    up(field);
    type(field, 'B');
    caret(field, 0);
    up(field);
    expect(botDraft('b1')).toBe('fix the build\nthen push');
    down(field);
    expect(botDraft('b1')).toBe('B');
    type(field, 'B!');
    down(field);
    expect(botDraft('b1')).toBe('A');
    caret(field, 0);
    up(field);
    expect(botDraft('b1')).toBe('B!');
  });

  it('steps only from the very start or end of a draft, so a line the field wraps keeps its arrows', () => {
    const field = composer();
    type(field, 'a paragraph long enough to wrap across several visual lines');
    caret(field, 20);
    up(field);
    expect(botDraft('b1')).toBe('a paragraph long enough to wrap across several visual lines');
    caret(field, 0);
    up(field);
    expect(botDraft('b1')).toBe('run the tests');
  });

  it('does nothing on Down with nothing recalled', () => {
    const field = composer();
    type(field, 'draft');
    down(field);
    expect(botDraft('b1')).toBe('draft');
  });
});

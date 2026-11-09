import { BotSkillEntity } from '@oppenheimer/frontend-consumer';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { botDraft, setBotDraft } from '../lib/bot-drafts';
import { closeUsageCard, usageCardOpen } from '../lib/usage-cards';
import { BotComposer } from '../sections/bot-composer';

/**
 * Running a command or a skill from the composer (`25-bots.md` §4.1). What
 * breaks this: the menu staying shut while a command is typed, or opening
 * over an ordinary message; Enter sending a half-typed `/rel` instead of
 * picking the skill it names; the keyboard moving no highlight; Escape not
 * letting the person send what they typed; a skill only the bot may use
 * offered as a command; `/goal` missing from the menu, or a skill named
 * `goal` offered in its place; `/goal clear` sent to the bot as a message
 * instead of stopping the goal; `/goal` with no condition sent at all;
 * `/usage` sent to the bot instead of putting the usage card in the chat.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      options?.name === undefined ? key : `${key}:${options.name}`,
    i18n: { resolvedLanguage: 'en', language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

vi.mock('@oppenheimer/frontend-core/react', () => ({
  useErrorMessage: () => (_error: unknown, fallback: string) => ({ message: fallback }),
}));

function skill(name: string, userInvocable = true) {
  const at = new Date('2026-10-30T10:00:00Z');
  return new BotSkillEntity(
    name,
    name,
    `Does ${name}.`,
    'Steps.',
    userInvocable,
    true,
    'user',
    at,
    at,
  );
}

const state = vi.hoisted(() => ({
  send: vi.fn(),
  clearGoal: vi.fn(),
  resumeGoal: vi.fn(),
  read: vi.fn(),
  skills: [] as BotSkillEntity[] | undefined,
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useBotActiveTurn: () => null,
  useBotGoal: () => ({ data: null }),
  useBotLoop: () => ({ data: null }),
  useBotWaitingMessages: () => [],
  useModelProviders: () => ({ data: true }),
  useSendBotMessage: () => ({ mutate: state.send, reset: vi.fn(), error: null, isPending: false }),
  useUploadBotImage: () => ({ mutateAsync: vi.fn() }),
  useCancelBotTurn: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useClearBotLoop: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useClearBotGoal: () => ({
    mutate: state.clearGoal,
    reset: vi.fn(),
    error: null,
    isPending: false,
  }),
  useResumeBotGoal: () => ({
    mutate: state.resumeGoal,
    reset: vi.fn(),
    error: null,
    isPending: false,
  }),
  useVoiceDictation: () => ({ available: false, transcribe: async () => null }),
  useBotSlashCommands: (_id: string, enabled: boolean) => {
    state.read(enabled);
    return { data: enabled ? state.skills : undefined };
  },
}));

beforeEach(() => {
  setBotDraft('b1', '');
  state.skills = [
    skill('release-notes'),
    skill('review'),
    skill('triage'),
    skill('deploy', false),
    skill('goal'),
  ];
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
  return screen.getByRole('textbox');
}

const type = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } });
const options = () => screen.queryAllByRole('option').map((option) => option.textContent);

describe('BotComposer’s / menu', () => {
  it('opens on a /, listing the built-ins then the skills the person may run, /recap first, and reads none before', () => {
    const field = composer();
    expect(state.read).toHaveBeenLastCalledWith(false);
    type(field, '/');
    expect(state.read).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('listbox', { name: 'bots.chat.slash.menu' })).toBeTruthy();
    expect(options()).toEqual([
      '/goalbots.chat.slash.builtIn.goal',
      '/usagebots.chat.slash.builtIn.usage',
      '/loopbots.chat.slash.builtIn.loop',
      '/schedulebots.chat.slash.builtIn.schedule',
      '/recapbots.chat.slash.builtInSkill.recap',
      '/release-notesDoes release-notes.',
      '/reviewDoes review.',
      '/triageDoes triage.',
    ]);
  });

  it('offers no /recap until the bot’s skills are read, since one of its own may take the name', () => {
    state.skills = undefined;
    const field = composer();
    type(field, '/re');
    expect(screen.queryByRole('listbox')).toBeNull();
    type(field, '/');
    expect(options()).toEqual([
      '/goalbots.chat.slash.builtIn.goal',
      '/usagebots.chat.slash.builtIn.usage',
      '/loopbots.chat.slash.builtIn.loop',
      '/schedulebots.chat.slash.builtIn.schedule',
    ]);
  });

  it('narrows as the name is typed, and closes once the command has its input or is a plain message', () => {
    const field = composer();
    type(field, '/re');
    expect(options()).toHaveLength(3);
    type(field, '/tri');
    expect(options()).toEqual(['/triageDoes triage.']);
    type(field, '/triage the build');
    expect(screen.queryByRole('listbox')).toBeNull();
    type(field, 'see /etc/hosts');
    expect(screen.queryByRole('listbox')).toBeNull();
    type(field, '/nothing-matches');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('picks the highlighted skill on Enter instead of sending, the arrows moving the highlight', () => {
    const field = composer();
    type(field, '/re');
    const [first] = screen.getAllByRole('option');
    expect(first?.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]?.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(state.send).not.toHaveBeenCalled();
    expect(botDraft('b1')).toBe('/release-notes ');
  });

  it('picks on Tab and on a click, and wraps the highlight from the top', () => {
    const field = composer();
    type(field, '/');
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    fireEvent.keyDown(field, { key: 'Tab' });
    expect(botDraft('b1')).toBe('/triage ');
    type(field, '/go');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(botDraft('b1')).toBe('/goal ');
    type(field, '/rel');
    fireEvent.click(screen.getByRole('option', { name: 'bots.chat.slash.pick:release-notes' }));
    expect(botDraft('b1')).toBe('/release-notes ');
  });

  it('closes on Escape, so Enter then sends what was typed', () => {
    const field = composer();
    type(field, '/re');
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(state.send).toHaveBeenCalledWith(expect.objectContaining({ id: 'b1', content: '/re' }));
  });

  it('sends /goal <condition> to the bot like any message', () => {
    const field = composer();
    type(field, '/goal pnpm test exits 0');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(state.send).toHaveBeenCalledWith(
      expect.objectContaining({ content: '/goal pnpm test exits 0' }),
    );
  });

  it('stops the goal on /goal clear without sending the bot anything', () => {
    const field = composer();
    type(field, '/goal clear');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(state.clearGoal).toHaveBeenCalledWith({ id: 'b1' }, expect.anything());
    expect(state.send).not.toHaveBeenCalled();
  });

  // What breaks this: /goal resume sent to the bot as a new goal whose
  // condition is "resume", replacing the paused one it meant to run again.
  it('resumes the goal on /goal resume without sending the bot anything', () => {
    const field = composer();
    type(field, '/goal resume');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(state.resumeGoal).toHaveBeenCalledWith({ id: 'b1' }, expect.anything());
    expect(state.send).not.toHaveBeenCalled();
  });

  it('keeps /goal with no condition from being sent, saying what it lacks', () => {
    const field = composer();
    type(field, '/goal ');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(state.send).not.toHaveBeenCalled();
    expect(screen.getAllByText('bots.chat.goal.needsCondition').length).toBeGreaterThan(0);
  });

  it('puts the usage card in the chat on /usage, sending the bot nothing', () => {
    const field = composer();
    type(field, '/usage');
    // The menu is open on the command: Enter picks it, a second Enter runs it.
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(state.send).not.toHaveBeenCalled();
    expect(usageCardOpen('b1')).toBe(true);
    expect(botDraft('b1')).toBe('');
    closeUsageCard('b1');
  });
});

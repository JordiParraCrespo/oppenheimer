import { BotSkillEntity } from '@oppenheimer/frontend-consumer';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { botDraft, setBotDraft } from '../lib/bot-drafts';
import { BotComposer } from '../sections/bot-composer';

/**
 * Running a skill from the composer (`25-bots.md` §4.1). What breaks this: the
 * menu staying shut while a command is typed, or opening over an ordinary
 * message; Enter sending a half-typed `/rel` instead of picking the skill it
 * names; the keyboard moving no highlight; Escape not letting the person send
 * what they typed; a skill only the bot may use offered as a command.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      options?.name === undefined ? key : `${key}:${options.name}`,
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
  read: vi.fn(),
  skills: [] as BotSkillEntity[],
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useBotActiveTurn: () => null,
  useBotGoal: () => ({ data: null }),
  useBotWaitingMessages: () => [],
  useModelProviders: () => ({ data: true }),
  useSendBotMessage: () => ({ mutate: state.send, reset: vi.fn(), error: null, isPending: false }),
  useUploadBotImage: () => ({ mutateAsync: vi.fn() }),
  useCancelBotTurn: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useVoiceDictation: () => ({ available: false, transcribe: async () => null }),
  // The hook's own `select`: only what the person may run.
  useBotSlashCommands: (_id: string, enabled: boolean) => {
    state.read(enabled);
    return { data: enabled ? state.skills.filter((s) => s.userInvocable) : undefined };
  },
}));

beforeEach(() => {
  setBotDraft('b1', '');
  state.skills = [skill('release-notes'), skill('review'), skill('triage'), skill('deploy', false)];
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
  it('opens on a /, listing the skills the person may run, and reads none before', () => {
    const field = composer();
    expect(state.read).toHaveBeenLastCalledWith(false);
    type(field, '/');
    expect(state.read).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('listbox', { name: 'bots.chat.slash.menu' })).toBeTruthy();
    expect(options()).toEqual([
      '/release-notesDoes release-notes.',
      '/reviewDoes review.',
      '/triageDoes triage.',
    ]);
  });

  it('narrows as the name is typed, and closes once the command has its input or is a plain message', () => {
    const field = composer();
    type(field, '/re');
    expect(options()).toHaveLength(2);
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
    expect(botDraft('b1')).toBe('/review ');
  });

  it('picks on Tab and on a click, and wraps the highlight from the top', () => {
    const field = composer();
    type(field, '/');
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    fireEvent.keyDown(field, { key: 'Tab' });
    expect(botDraft('b1')).toBe('/triage ');
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
});

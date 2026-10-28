import { BotEntity } from '@oppenheimer/frontend-consumer';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SectionBotsMenu } from '../sections/section-bots-menu';

/**
 * The plus on a section's Bots heading (`28-bots-in-sections.md`, slice D):
 * every bot is listed with whether this section shows it, so a bot already
 * made is placed here without leaving the page; the search narrows the list;
 * and New bot still makes one.
 * The bots read is the product package's `useBots`, mocked here.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const read = vi.hoisted(() => ({ bots: [] as unknown[] }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useBots: () => ({ data: read.bots, isPending: false, isError: false }),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

function bot(id: string, name: string, sections: BotSection[], description = ''): BotEntity {
  const at = new Date('2026-10-26T09:00:00Z');
  return new BotEntity(
    id,
    name,
    description,
    'mint',
    null,
    0,
    null,
    'anthropic',
    null,
    null,
    'auto',
    true,
    at,
    at,
    at,
    null,
    sections,
  );
}

afterEach(() => {
  cleanup();
  read.bots = [];
});

function renderMenu(props: Partial<Parameters<typeof SectionBotsMenu>[0]> = {}) {
  const onPlace = vi.fn();
  const onCreate = vi.fn();
  render(
    <SectionBotsMenu
      section="pulls"
      open
      onOpenChange={() => {}}
      creating={false}
      onCreate={onCreate}
      saving={new Map()}
      onPlace={onPlace}
      {...props}
    />,
  );
  return { onPlace, onCreate };
}

describe('SectionBotsMenu', () => {
  it('checks the bots this section lists and places another here when it is checked', async () => {
    const release = bot('b1', 'Release Bot', ['pulls']);
    const planner = bot('b2', 'Planning Bot', ['plan']);
    read.bots = [release, planner];
    const { onPlace } = renderMenu();

    const shown = await screen.findByRole('option', { name: /Release Bot/ });
    const hidden = screen.getByRole('option', { name: /Planning Bot/ });
    expect(shown.getAttribute('aria-selected')).toBe('true');
    expect(hidden.getAttribute('aria-selected')).toBe('false');

    fireEvent.click(hidden);
    expect(onPlace).toHaveBeenCalledWith(planner, true);
  });

  it('holds only the bot whose placement is in flight, showing what was asked', async () => {
    read.bots = [bot('b1', 'Release Bot', ['pulls']), bot('b2', 'Planning Bot', ['plan'])];
    renderMenu({ saving: new Map([['b2', ['plan', 'pulls']]]) });
    const saving = await screen.findByRole('option', { name: /Planning Bot/ });
    const other = screen.getByRole('option', { name: /Release Bot/ });
    expect(saving.getAttribute('aria-selected')).toBe('true');
    expect(saving.getAttribute('aria-disabled')).toBe('true');
    expect(other.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('holds a bot whose placement is in flight against a second click', async () => {
    const planner = bot('b2', 'Planning Bot', ['plan']);
    read.bots = [planner];
    const { onPlace } = renderMenu({ saving: new Map([['b2', ['plan', 'pulls']]]) });
    fireEvent.click(await screen.findByRole('option', { name: /Planning Bot/ }));
    expect(onPlace).not.toHaveBeenCalled();
  });

  it('narrows the bots to what the search matches, by name or description', async () => {
    read.bots = [
      bot('b1', 'Release Bot', ['pulls']),
      bot('b2', 'Planning Bot', ['plan'], 'Keeps the roadmap'),
    ];
    renderMenu();
    fireEvent.change(await screen.findByRole('textbox', { name: 'bots.sidebar.search' }), {
      target: { value: 'roadmap' },
    });
    expect(screen.getByRole('option', { name: /Planning Bot/ })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Release Bot/ })).toBeNull();
  });

  it('says so when the search matches no bot', async () => {
    read.bots = [bot('b1', 'Release Bot', ['pulls'])];
    renderMenu();
    fireEvent.change(await screen.findByRole('textbox', { name: 'bots.sidebar.search' }), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('bots.sidebar.noMatch')).toBeTruthy();
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('places the highlighted bot on Enter, so the search never needs the mouse', async () => {
    const release = bot('b1', 'Release Bot', ['pulls']);
    const planner = bot('b2', 'Planning Bot', ['plan']);
    read.bots = [release, planner];
    const { onPlace } = renderMenu();
    const search = await screen.findByRole('textbox', { name: 'bots.sidebar.search' });
    fireEvent.change(search, { target: { value: 'plan' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onPlace).toHaveBeenCalledWith(planner, true);
  });

  it('still makes a new bot', async () => {
    const { onCreate } = renderMenu();
    fireEvent.click(await screen.findByRole('button', { name: 'bots.sidebar.new' }));
    expect(onCreate).toHaveBeenCalledOnce();
  });
});

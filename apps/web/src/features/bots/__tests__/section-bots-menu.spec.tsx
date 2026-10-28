import { BotEntity } from '@oppenheimer/frontend-consumer';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SectionBotsMenu } from '../sections/section-bots-menu';

/**
 * The plus on a section's Bots heading (`28-bots-in-sections.md`, slice D):
 * every bot is listed with whether this section shows it, so a bot already
 * made is placed here without leaving the page, and New bot still makes one.
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

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, ...props }: { to: string }) => <a href={to} {...props} />,
}));

function bot(id: string, name: string, sections: BotSection[]): BotEntity {
  const at = new Date('2026-10-26T09:00:00Z');
  return new BotEntity(
    id,
    name,
    '',
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

    const shown = await screen.findByRole('menuitemcheckbox', { name: /Release Bot/ });
    const hidden = screen.getByRole('menuitemcheckbox', { name: /Planning Bot/ });
    expect(shown.getAttribute('aria-checked')).toBe('true');
    expect(hidden.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(hidden);
    expect(onPlace).toHaveBeenCalledWith(planner, true);
  });

  it('holds only the bot whose placement is in flight, showing what was asked', async () => {
    read.bots = [bot('b1', 'Release Bot', ['pulls']), bot('b2', 'Planning Bot', ['plan'])];
    renderMenu({ saving: new Map([['b2', ['plan', 'pulls']]]) });
    const saving = await screen.findByRole('menuitemcheckbox', { name: /Planning Bot/ });
    const other = screen.getByRole('menuitemcheckbox', { name: /Release Bot/ });
    expect(saving.getAttribute('aria-checked')).toBe('true');
    expect(saving.getAttribute('aria-disabled')).toBe('true');
    expect(other.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('still makes a new bot', async () => {
    const { onCreate } = renderMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'bots.sidebar.new' }));
    expect(onCreate).toHaveBeenCalledOnce();
  });
});

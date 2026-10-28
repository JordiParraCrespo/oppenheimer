import { BotEntity } from '@oppenheimer/frontend-consumer';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SectionBotsList } from '../sections/section-bots-list';

/**
 * A section's Bots heading (`28-bots-in-sections.md`): a row opens the bot's
 * chat inside that section, so the reader never leaves it, and the heading
 * says how one gets here before the first bot. A row's ellipsis hides the bot
 * from this section and no other. Which bots a section lists is the product
 * package's `useSuspenseSectionBots`, mocked here.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const listed = vi.hoisted(() => ({ bots: [] as unknown[] }));
const update = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSuspenseSectionBots: () => ({ data: listed.bots, error: null }),
  useUpdateBot: () => ({ mutate: update.mutate, error: null, reset: () => {} }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, params, ...props }: { to: string; params: { botId: string } }) => (
    <a href={to.replace('$botId', params.botId)} {...props} />
  ),
  useRouterState: () => false,
  useNavigate: () => vi.fn(),
}));

function bot(id: string, name: string, sections: BotSection[]): BotEntity {
  const at = new Date('2026-10-26T09:00:00Z');
  return new BotEntity(
    id,
    name,
    'Ships releases',
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
  listed.bots = [];
  update.mutate.mockReset();
});

describe('SectionBotsList', () => {
  it('opens a bot’s chat inside Pull requests, beside that section’s list', () => {
    listed.bots = [bot('b1', 'Release Bot', ['pulls'])];
    render(<SectionBotsList section="pulls" onAdd={() => {}} />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/pulls/bots/b1');
  });

  it('opens a bot’s chat inside Sessions, Automations and Plan too, never in Employees', () => {
    listed.bots = [bot('b2', 'Session Bot', ['sessions', 'automations', 'plan'])];
    for (const section of ['sessions', 'automations', 'plan'] as const) {
      render(<SectionBotsList section={section} onAdd={() => {}} />);
      expect(screen.getByRole('link').getAttribute('href')).toBe(`/${section}/bots/b2`);
      cleanup();
    }
  });

  it('offers the heading’s menu when the section has no bot yet', () => {
    const onAdd = vi.fn();
    render(<SectionBotsList section="plan" onAdd={onAdd} />);
    expect(screen.getByText(/bots\.section\.empty/)).toBeTruthy();
    expect(screen.queryByRole('listitem')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'bots.section.add' }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('hides a bot from this section only, keeping the others it shows in', async () => {
    listed.bots = [bot('b3', 'Release Bot', ['sessions', 'pulls'])];
    render(<SectionBotsList section="pulls" onAdd={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'bots.sidebar.rowActions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'bots.section.hide' }));
    expect(update.mutate).toHaveBeenCalledWith({ id: 'b3', input: { sections: ['sessions'] } });
  });
});

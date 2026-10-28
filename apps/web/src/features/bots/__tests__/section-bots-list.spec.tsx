import { BotEntity } from '@oppenheimer/frontend-consumer';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SectionBotsList } from '../sections/section-bots-list';

/**
 * A section's Bots heading (`28-bots-in-sections.md`): a row opens the bot's
 * chat inside that section, so the reader never leaves it, and the heading
 * says how one gets here before the first bot. A row's ellipsis hands its
 * Hide to the heading, which owns every placement write. Which bots a section lists is the product
 * package's `useSuspenseSectionBots`, mocked here.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const listed = vi.hoisted(() => ({ bots: [] as unknown[] }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSuspenseSectionBots: () => ({ data: listed.bots, error: null }),
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
});

describe('SectionBotsList', () => {
  it('opens a bot’s chat inside Pull requests, beside that section’s list', () => {
    listed.bots = [bot('b1', 'Release Bot', ['pulls'])];
    render(<SectionBotsList section="pulls" onAdd={() => {}} onHide={() => {}} />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/pulls/bots/b1');
  });

  it('opens a bot’s chat inside Sessions, Automations and Plan too, never in Employees', () => {
    listed.bots = [bot('b2', 'Session Bot', ['sessions', 'automations', 'plan'])];
    for (const section of ['sessions', 'automations', 'plan'] as const) {
      render(<SectionBotsList section={section} onAdd={() => {}} onHide={() => {}} />);
      expect(screen.getByRole('link').getAttribute('href')).toBe(`/${section}/bots/b2`);
      cleanup();
    }
  });

  it('offers the heading’s menu when the section has no bot yet', () => {
    const onAdd = vi.fn();
    render(<SectionBotsList section="plan" onAdd={onAdd} onHide={() => {}} />);
    expect(screen.getByText(/bots\.section\.empty/)).toBeTruthy();
    expect(screen.queryByRole('listitem')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'bots.section.add' }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('hands a row’s Hide to the heading with the bot it hides', async () => {
    const release = bot('b3', 'Release Bot', ['sessions', 'pulls']);
    listed.bots = [release];
    const onHide = vi.fn();
    render(<SectionBotsList section="pulls" onAdd={() => {}} onHide={onHide} />);
    fireEvent.click(screen.getByRole('button', { name: 'bots.sidebar.rowActions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'bots.section.hide' }));
    expect(onHide).toHaveBeenCalledWith(release);
  });
});

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeleteBotDialog } from '../dialogs/delete-bot';

/**
 * Where Delete bot leaves a reader: off every page of the bot that is gone,
 * its chat inside Pull requests included (`28-bots-in-sections.md`), and
 * where they were when the page they read was another.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const at = vi.hoisted(() => ({ pathname: '/bots' }));
const navigate = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: at.pathname } }),
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useDeleteBot: ({ onSuccess }: { onSuccess: () => void }) => ({
    mutate: () => onSuccess(),
    isPending: false,
    error: null,
  }),
}));

vi.mock('@oppenheimer/frontend-web', () => ({
  notifySuccess: () => {},
  ConfirmDialog: ({ onConfirm }: { onConfirm: () => void }) => (
    <button type="button" onClick={onConfirm}>
      confirm
    </button>
  ),
}));

const bot = { id: 'b1', name: 'Release Bot' };

function deleteFrom(pathname: string) {
  at.pathname = pathname;
  render(<DeleteBotDialog bot={bot} onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
}

afterEach(() => {
  cleanup();
  navigate.mockClear();
});

describe('DeleteBotDialog', () => {
  it('leaves the bot’s chat inside Pull requests for the queue', () => {
    deleteFrom('/pulls/bots/b1');
    expect(navigate).toHaveBeenCalledWith({ to: '/pulls' });
  });

  it('leaves the bot’s own pages for Employees', () => {
    deleteFrom('/bots/b1/settings/profile');
    expect(navigate).toHaveBeenCalledWith({ to: '/bots' });
  });

  it('stays put when the page open is another bot’s', () => {
    deleteFrom('/pulls/bots/b2');
    expect(navigate).not.toHaveBeenCalled();
  });
});

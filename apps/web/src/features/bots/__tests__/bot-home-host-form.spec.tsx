import { HostEntity } from '@oppenheimer/frontend-consumer';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotHomeHostForm } from '../forms/bot-home-host-form';

/**
 * Home host as a draft: a pick saves nothing until Save (it used to save on
 * the click, with no way back), Cancel puts the saved host back, and No home
 * host sends `null`, so the bot asks which machine to use.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

afterEach(cleanup);

const BUILD = '3f9a2c1e-8b4d-4e6f-9a1b-2c3d4e5f6a7b';
const DEVBOX = '7c1d9e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f';

function host(id: string, name: string, online: boolean): HostEntity {
  return new HostEntity(id, name, online, name, 'linux', 'x64', '1.0.0', null, new Date());
}

function renderForm(homeHostId: string | null, onSubmit = vi.fn()) {
  render(
    <BotHomeHostForm
      hosts={[host(BUILD, 'build-01', true), host(DEVBOX, 'devbox', false)]}
      values={{ homeHostId }}
      pending={false}
      saved={false}
      onSubmit={onSubmit}
      onDiscard={vi.fn()}
    />,
  );
  return onSubmit;
}

const radio = (name: RegExp) => screen.getByRole('radio', { name });
const save = () => screen.queryByRole('button', { name: 'bots.settings.homeHost.save' });

describe('BotHomeHostForm', () => {
  it('opens on No home host when the bot has none, with nothing to save', () => {
    renderForm(null);
    expect(radio(/bots.settings.homeHost.none/).getAttribute('aria-checked')).toBe('true');
    expect(save()).toBeNull();
  });

  it('keeps a pick as a draft until Save, then sends the host', async () => {
    const onSubmit = renderForm(null);
    fireEvent.click(radio(/build-01/));

    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(save() as HTMLElement);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ homeHostId: BUILD }));
  });

  it('puts the saved host back on Cancel', () => {
    renderForm(BUILD);
    fireEvent.click(radio(/devbox/));
    fireEvent.click(screen.getByRole('button', { name: 'bots.settings.homeHost.discard' }));

    expect(radio(/build-01/).getAttribute('aria-checked')).toBe('true');
    expect(save()).toBeNull();
  });

  it('sends null for No home host', async () => {
    const onSubmit = renderForm(BUILD);
    fireEvent.click(radio(/bots.settings.homeHost.none/));
    fireEvent.click(save() as HTMLElement);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ homeHostId: null }));
  });
});

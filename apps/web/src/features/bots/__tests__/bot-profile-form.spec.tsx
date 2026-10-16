import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotProfileForm } from '../forms/bot-profile-form';

/**
 * The Profile card's name and description: the save row appears only once
 * something changed, a blank name is refused on the field rather than sent,
 * and what is sent is trimmed the way the API's schema would trim it.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

afterEach(cleanup);

function renderForm(onSubmit = vi.fn(), saved = false) {
  render(
    <BotProfileForm
      values={{ name: 'New Bot', description: '' }}
      pending={false}
      saved={saved}
      onSubmit={onSubmit}
      onDiscard={vi.fn()}
    />,
  );
  return onSubmit;
}

const save = () => screen.queryByRole('button', { name: 'bots.settings.profile.save' });

describe('BotProfileForm', () => {
  it('offers Save only once the name or description changed', () => {
    renderForm();
    expect(save()).toBeNull();

    fireEvent.change(screen.getByLabelText('bots.settings.profile.name'), {
      target: { value: 'Release Bot' },
    });

    expect(save()).not.toBeNull();
  });

  it('sends the name and description trimmed', async () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText('bots.settings.profile.name'), {
      target: { value: '  Release Bot ' },
    });
    fireEvent.change(screen.getByLabelText('bots.settings.profile.description'), {
      target: { value: ' Ships changes ' },
    });
    fireEvent.click(save() as HTMLElement);

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Release Bot', description: 'Ships changes' }),
    );
  });

  it('refuses a blank name on the field and sends nothing', async () => {
    const onSubmit = renderForm();
    const name = screen.getByLabelText('bots.settings.profile.name');
    fireEvent.change(name, { target: { value: '   ' } });
    fireEvent.click(save() as HTMLElement);

    await waitFor(() => expect(name.getAttribute('aria-invalid')).toBe('true'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('puts the name back on Discard', () => {
    renderForm();
    const name = screen.getByLabelText('bots.settings.profile.name') as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Something else' } });
    fireEvent.click(screen.getByRole('button', { name: 'bots.settings.profile.discard' }));

    expect(name.value).toBe('New Bot');
    expect(save()).toBeNull();
  });
});

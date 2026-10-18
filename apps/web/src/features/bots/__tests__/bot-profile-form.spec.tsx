import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useController } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type BotProfileControl, BotProfileForm } from '../forms/bot-profile-form';

/**
 * The Profile card as one draft: the save row appears only once something
 * changed, the colour and the group included (they used to save on the
 * click, the only fields of the bot's settings that did), a blank name is
 * refused on the field rather than sent, what is sent is trimmed the way the
 * API's schema would trim it, and only what changed is sent, so an untouched
 * group never moves the bot to the end of it.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

afterEach(cleanup);

/** Stands in for the colour row: binds the field the way `BotAvatarColor` does. */
function CoralButton({ control }: { control: BotProfileControl }) {
  const { field } = useController({ control, name: 'avatarColor' });
  return (
    <button
      type="button"
      aria-pressed={field.value === 'coral'}
      onClick={() => field.onChange('coral')}
    >
      Coral
    </button>
  );
}

function renderForm(onSubmit = vi.fn(), saved = false) {
  render(
    <BotProfileForm
      values={{ name: 'New Bot', description: '', avatarColor: 'mint', groupId: null }}
      pending={false}
      saved={saved}
      onSubmit={onSubmit}
      onDiscard={vi.fn()}
    >
      {(control) => <CoralButton control={control} />}
    </BotProfileForm>,
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

  it('sends only the fields that changed', async () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText('bots.settings.profile.name'), {
      target: { value: 'Release Bot' },
    });
    fireEvent.click(save() as HTMLElement);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Release Bot' }));
  });

  it('keeps a colour pick as a draft until Save, then sends it alone', async () => {
    const onSubmit = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Coral' }));

    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(save() as HTMLElement);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ avatarColor: 'coral' }));
  });

  it('puts the colour back on Discard', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Coral' }));
    fireEvent.click(screen.getByRole('button', { name: 'bots.settings.profile.discard' }));

    expect(screen.getByRole('button', { name: 'Coral' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(save()).toBeNull();
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

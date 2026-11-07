import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BotProfileValues } from '../forms/bot-profile-form';
import { BotAvatarColor } from '../sections/bot-avatar-color';
import { BotAvatarFace } from '../sections/bot-avatar-face';
import { BotGroupSelect } from '../sections/bot-group-select';

/**
 * The Profile card's colour and group wait while a save is in flight, as the
 * text fields do. What breaks this: a pick made after Save, which the saved
 * bot then resets the form over, so the reader's change vanishes unsaid.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useBotGroups: () => ({ data: [] }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/bots">{children}</a>,
}));

afterEach(cleanup);

function Pickers({ pending }: { pending: boolean }) {
  const { control } = useForm<BotProfileValues>({
    defaultValues: {
      name: 'Release Bot',
      description: '',
      avatarColor: 'mint',
      avatarFace: null,
      groupId: null,
    },
  });
  return (
    <>
      <BotAvatarColor
        bot={{ id: 'bot-1', initials: 'RB', name: 'Release Bot' }}
        control={control}
        pending={pending}
      />
      <BotAvatarFace botId="bot-1" control={control} pending={pending} />
      <BotGroupSelect botId="bot-1" control={control} pending={pending} />
    </>
  );
}

const colours = () =>
  screen
    .getAllByRole('button')
    .filter(
      (button) =>
        button.hasAttribute('aria-pressed') && !button.closest('[data-slot="bot-face-picker"]'),
    );
const group = () => screen.getByLabelText('bots.settings.profile.group');

describe('Profile pickers', () => {
  it('take a pick while nothing is saving', () => {
    render(<Pickers pending={false} />);
    expect(colours().length).toBe(8);
    expect(colours().every((button) => !(button as HTMLButtonElement).disabled)).toBe(true);
    expect(
      group().hasAttribute('disabled') || group().getAttribute('aria-disabled') === 'true',
    ).toBe(false);
  });

  it('wait while a save is in flight', () => {
    render(<Pickers pending />);
    expect(colours().every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(
      group().hasAttribute('disabled') || group().getAttribute('aria-disabled') === 'true',
    ).toBe(true);
  });
});

/**
 * A bot with no photo shows its drawn face, picked from its id, never its
 * initials. What breaks this: a caller that stops passing the id as `seed`,
 * so the face falls back to letters, or a face drawn from something that
 * changes (the name), so a rename gives the bot a new face.
 */
describe('Profile colour preview', () => {
  it("draws the bot's face, the same one for the same id", () => {
    const { container, unmount } = render(<Pickers pending={false} />);
    const face = container.querySelector('[data-slot="bot-face"]');
    expect(face).not.toBeNull();
    expect(screen.queryByText('RB')).toBeNull();
    const hat = face?.getAttribute('data-hat');
    unmount();
    const again = render(<Pickers pending={false} />).container.querySelector(
      '[data-slot="bot-face"]',
    );
    expect(again?.getAttribute('data-hat')).toBe(hat);
  });
});

/**
 * A face picked in the face row is the face the colour row's preview wears
 * before Save, as the colour is. What breaks this: the preview drawing the
 * saved face (or the id's) while the draft holds another, so the owner saves
 * a face they never saw.
 */
describe('Profile face row', () => {
  it("puts a picked hat on the preview's face", () => {
    const { container } = render(<Pickers pending={false} />);
    const preview = () =>
      container.querySelector('[data-slot="avatar-color-picker"] [data-slot="bot-face"]');
    const before = preview()?.getAttribute('data-hat');
    const other = before === 'tophat' ? 'cap' : 'tophat';
    fireEvent.click(
      screen.getByRole('button', { name: `bots.settings.profile.faces.hat.${other}` }),
    );
    expect(preview()?.getAttribute('data-hat')).toBe(other);
  });
});

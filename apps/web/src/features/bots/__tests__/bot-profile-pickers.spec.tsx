import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BotProfileValues } from '../forms/bot-profile-form';
import { BotAvatarColor } from '../sections/bot-avatar-color';
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
    defaultValues: { name: 'Release Bot', description: '', avatarColor: 'mint', groupId: null },
  });
  return (
    <>
      <BotAvatarColor
        bot={{ initials: 'RB', name: 'Release Bot' }}
        control={control}
        pending={pending}
      />
      <BotGroupSelect botId="bot-1" control={control} pending={pending} />
    </>
  );
}

const colours = () =>
  screen.getAllByRole('button').filter((button) => button.hasAttribute('aria-pressed'));
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

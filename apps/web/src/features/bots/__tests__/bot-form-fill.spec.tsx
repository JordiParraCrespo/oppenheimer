import { botFormSpecSchema } from '@oppenheimer/shared/schemas/bot';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotFormFill } from '../forms/bot-form-fill';

/**
 * A bot's form as the person fills it. What breaks this: a form that sends
 * with a required field blank or a number out of its bounds (the API would
 * refuse it, after the person waited); a mistake said in Zod's English
 * instead of through the translated keys; a number sent as words, or a blank
 * sent as `''` instead of nothing; the bot's own word for the button lost.
 */

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const SPEC = botFormSpecSchema.parse({
  title: 'Release details',
  fields: [
    { id: 'version', kind: 'text', label: 'Version', required: true },
    { id: 'replicas', kind: 'number', label: 'Replicas', min: 1, max: 5, default: 2 },
    { id: 'contact', kind: 'email', label: 'Contact' },
    { id: 'notes', kind: 'textarea', label: 'Notes' },
  ],
  submitLabel: 'Cut it',
});

afterEach(cleanup);

function fill(label: string, value: string) {
  const input = screen.getByLabelText(new RegExp(`^${label}`));
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe('BotFormFill', () => {
  it('says what is wrong where it is, in translated words, and sends nothing', async () => {
    const onSubmit = vi.fn();
    render(<BotFormFill spec={SPEC} isPending={false} onSubmit={onSubmit} onDismiss={vi.fn()} />);
    fill('Replicas', '9');
    fill('Contact', 'not an address');
    fireEvent.click(screen.getByRole('button', { name: 'Cut it' }));
    await waitFor(() => expect(screen.getByText('validation.required')).toBeTruthy());
    expect(screen.getByText('validation.max')).toBeTruthy();
    expect(screen.getByText('validation.email')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends a value per field: a number as a number, a blank as nothing', async () => {
    const onSubmit = vi.fn();
    render(<BotFormFill spec={SPEC} isPending={false} onSubmit={onSubmit} onDismiss={vi.fn()} />);
    fill('Version', '  v2.4.0 ');
    fireEvent.click(screen.getByRole('button', { name: 'Cut it' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenLastCalledWith({
      version: 'v2.4.0',
      replicas: 2,
      contact: null,
      notes: null,
    });
  });

  it('declines with Not now', () => {
    const onDismiss = vi.fn();
    render(<BotFormFill spec={SPEC} isPending={false} onSubmit={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.form.dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});

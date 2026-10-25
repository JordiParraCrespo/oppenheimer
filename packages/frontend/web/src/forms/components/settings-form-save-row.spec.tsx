import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsFormSaveRow } from './settings-form-save-row';

/**
 * The settings card's save row: hidden while the draft is what is saved,
 * Discard and Save once it differs, Save pending and Discard waiting while a
 * save is in flight, and "Saved" after one until the next edit. What breaks
 * it: a row that shows Save over an unchanged draft, or lets Discard undo a
 * draft whose save is still on its way.
 */

afterEach(cleanup);

const labels = { discard: 'Discard', save: 'Save', saving: 'Saving…', saved: 'Saved' };

function Harness({ pending = false, saved = false, onDiscard = vi.fn() }) {
  const { control, register } = useForm({ defaultValues: { name: 'Bot' } });
  return (
    <form>
      <input aria-label="Name" {...register('name')} />
      <SettingsFormSaveRow
        control={control}
        pending={pending}
        saved={saved}
        labels={labels}
        onDiscard={onDiscard}
      />
    </form>
  );
}

const button = (name: string) => screen.queryByRole('button', { name }) as HTMLButtonElement | null;

describe('SettingsFormSaveRow', () => {
  it('shows nothing while the draft is what is saved', () => {
    render(<Harness />);
    expect(button('Save')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('offers Discard and Save once the draft differs, and Discard is the caller’s', async () => {
    const onDiscard = vi.fn();
    render(<Harness onDiscard={onDiscard} />);
    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Release Bot' } });

    expect(await screen.findByRole('button', { name: 'Save' })).toBeTruthy();
    fireEvent.click(button('Discard') as HTMLElement);
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it('keeps Discard waiting while the save is in flight', async () => {
    render(<Harness pending />);
    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Release Bot' } });

    expect(await screen.findByRole('button', { name: 'Discard' })).toHaveProperty('disabled', true);
  });

  it('says Saved after a save, until the next edit', async () => {
    render(<Harness saved />);
    expect(screen.getByRole('status').textContent).toBe('Saved');
    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Release Bot' } });
    expect(await screen.findByRole('button', { name: 'Save' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

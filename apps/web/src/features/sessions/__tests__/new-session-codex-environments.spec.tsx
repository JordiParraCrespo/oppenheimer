import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewSessionCodexEnvironments } from '../sections/new-session-codex-environments';

/**
 * The Codex environment pane asks nothing of the host: Codex cloud cannot list
 * an account's environments, so the pane offers Default, the id already
 * picked, and the id the person pasted in the search. A regression that
 * brings back a listing would call out (the fetch below), and one that stores
 * a pasted id wrongly would start the task in Codex's default environment.
 */
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (key: string, values?: { id?: string }) => (values?.id ? `${key} ${values.id}` : key),
  }),
}));

let value: { hostId: string; id: string; label: string } | null = null;
const onChange = vi.fn();
vi.mock('react-hook-form', () => ({
  useController: () => ({ field: { value, onChange } }),
}));

vi.mock('../hooks/use-new-session-form', () => ({
  useNewSessionDraft: () => ({ control: {} }),
}));

const DEFAULT = 'sessions.new.codexEnvironment.default';
const USE = 'sessions.new.codexEnvironment.use';
const fetchSpy = vi.fn();
const onDone = vi.fn();

function open(query = '') {
  render(<NewSessionCodexEnvironments hostId="h-1" query={query} onDone={onDone} />);
}

beforeEach(() => {
  value = null;
  onChange.mockReset();
  onDone.mockReset();
  fetchSpy.mockReset();
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(cleanup);

describe('NewSessionCodexEnvironments', () => {
  it('leads with Default, selected when nothing is picked, and picking it clears the pick', () => {
    open();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]?.textContent).toContain(DEFAULT);
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');

    fireEvent.click(options[0] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith(null);
    expect(onDone).toHaveBeenCalled();
  });

  it('offers a pasted id as "Use <id>" and stores it with the host', () => {
    open('  asenvcfg_oppenheimer ');

    const use = screen.getByRole('option', { name: `${USE} asenvcfg_oppenheimer` });
    fireEvent.click(use);
    expect(onChange).toHaveBeenCalledWith({
      hostId: 'h-1',
      id: 'asenvcfg_oppenheimer',
      label: 'asenvcfg_oppenheimer',
    });
  });

  it('offers nothing for a text with a space in it', () => {
    open('my environment');

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.queryByText(new RegExp(USE))).toBeNull();
  });

  it('shows the id picked on this host as selected, and Default as not', () => {
    value = { hostId: 'h-1', id: 'asenvcfg_kept', label: 'asenvcfg_kept' };
    open();

    const kept = screen.getByRole('option', { name: 'asenvcfg_kept' });
    expect(kept.getAttribute('aria-selected')).toBe('true');
    expect(
      screen.getByRole('option', { name: new RegExp(DEFAULT) }).getAttribute('aria-selected'),
    ).toBe('false');
  });

  it('asks the host nothing', () => {
    open('asenvcfg_oppenheimer');

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

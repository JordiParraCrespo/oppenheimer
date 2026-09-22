import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BranchSelect } from '../components/branch-select';
import { HostSelect } from '../components/host-select';
import { RepositoryBranchSelect } from '../components/repository-branch-select';

/**
 * What the three scope chips do while their lists are still being read.
 *
 * New session opens cold: the hosts, the installations' repositories and the
 * branches all arrive after the first paint, so for a moment every one of these
 * chips has an empty list. They used to be `disabled` for exactly that moment —
 * which is the same chip as one this workspace may not use, and made the screen
 * read as switched off.
 *
 * The contract has two halves and this asserts both, because the second is the
 * one that can silently rot: the chip stays pressable, **and** its popup says
 * "Loading …" rather than claiming nothing matches. A suite that only checked
 * `disabled` would pass with the loading line wired to the wrong string, or
 * never rendered at all.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

function chip(name: string) {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

/** Open a chip and hand back its popup. */
function openChip(name: string) {
  fireEvent.click(chip(name));
  return screen.getByRole('listbox');
}

describe('the scope chips', () => {
  it('says the hosts are loading rather than that none match', () => {
    render(
      <HostSelect hosts={[]} value={null} onValueChange={vi.fn()} onAddHost={vi.fn()} loading />,
    );

    expect(chip('sessions.new.host.label').disabled).toBe(false);
    const popup = openChip('sessions.new.host.label');
    expect(within(popup).getByText('sessions.new.host.loading')).toBeDefined();
    expect(within(popup).queryByText('sessions.new.host.empty')).toBeNull();
  });

  it('says the repositories are loading rather than that none match', () => {
    render(
      <RepositoryBranchSelect
        repositories={[]}
        value={[]}
        onValueChange={vi.fn()}
        onConnect={vi.fn()}
        loading
      />,
    );

    expect(chip('sessions.new.repository.label').disabled).toBe(false);
    const popup = openChip('sessions.new.repository.label');
    expect(within(popup).getByText('sessions.new.repository.loading')).toBeDefined();
    expect(within(popup).queryByText('sessions.new.repository.empty')).toBeNull();
  });

  it('says the branches are loading rather than that none match', () => {
    render(<BranchSelect branches={[]} value={null} onValueChange={vi.fn()} loading />);

    expect(chip('sessions.new.branch.label').disabled).toBe(false);
    const popup = openChip('sessions.new.branch.label');
    expect(within(popup).getByText('sessions.new.branch.loading')).toBeDefined();
    expect(within(popup).queryByText('sessions.new.branch.empty')).toBeNull();
  });

  it('is greyed out only when the screen says so', () => {
    render(
      <HostSelect hosts={[]} value={null} onValueChange={vi.fn()} onAddHost={vi.fn()} disabled />,
    );

    expect(chip('sessions.new.host.label').disabled).toBe(true);
  });
});

import { cleanup, render, screen } from '@testing-library/react';
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
 * read as switched off. A list in flight is `loading` now, and the only thing
 * that greys a chip is being told to.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

function chip(name: string) {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

describe('the scope chips', () => {
  it('stay pressable while their lists are loading', () => {
    render(
      <>
        <HostSelect hosts={[]} value={null} onValueChange={vi.fn()} onAddHost={vi.fn()} loading />
        <RepositoryBranchSelect
          repositories={[]}
          value={[]}
          onValueChange={vi.fn()}
          onConnect={vi.fn()}
          loading
        />
        <BranchSelect branches={[]} value={null} onValueChange={vi.fn()} loading />
      </>,
    );

    expect(chip('sessions.new.host.label').disabled).toBe(false);
    expect(chip('sessions.new.repository.label').disabled).toBe(false);
    expect(chip('sessions.new.branch.label').disabled).toBe(false);
  });

  it('are greyed out only when the screen says so', () => {
    render(
      <HostSelect hosts={[]} value={null} onValueChange={vi.fn()} onAddHost={vi.fn()} disabled />,
    );

    expect(chip('sessions.new.host.label').disabled).toBe(true);
  });
});

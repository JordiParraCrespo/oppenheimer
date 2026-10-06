import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BranchSelect } from '../components/branch-select';
import { HostSelect } from '../components/host-select';
import { RepositoryBranchSelect } from '../components/repository-branch-select';

/**
 * The three scope chips while their lists are still being read: New session
 * opens cold, and a `disabled` chip there reads as one this workspace may not
 * use. Both halves are asserted, because the second can rot silently: the
 * chip stays pressable, **and** its popup says "Loading …" rather than that
 * nothing matches.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

function chip(name: string) {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

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
        onManage={vi.fn()}
        loading
      />,
    );

    expect(chip('sessions.new.repository.label').disabled).toBe(false);
    const popup = openChip('sessions.new.repository.label');
    expect(within(popup).getByText('sessions.new.repository.loading')).toBeDefined();
    expect(within(popup).queryByText('sessions.new.repository.empty')).toBeNull();
  });

  it('hands the foot row to the caller, which mints before it leaves for GitHub', () => {
    // A button, not a link: the install URL carries a state minted on click, so
    // there is no address to put in an `href` at render.
    const onManage = vi.fn();
    render(
      <RepositoryBranchSelect
        repositories={[]}
        value={[]}
        onValueChange={vi.fn()}
        onManage={onManage}
        loading
      />,
    );

    openChip('sessions.new.repository.label');
    fireEvent.click(screen.getByRole('button', { name: 'common.repositoryAccess.manage' }));
    expect(onManage).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('says there is no GitHub App, with no foot row, when the deployment has none', () => {
    render(<RepositoryBranchSelect repositories={[]} value={[]} onValueChange={vi.fn()} />);

    const popup = openChip('sessions.new.repository.label');
    expect(within(popup).getByText('sessions.new.repository.noApp')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'common.repositoryAccess.manage' })).toBeNull();
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

import { Plus, Settings, Terminal } from '@oppenheimer/design-system-web/icons';
import { useMyPermissions } from '@oppenheimer/frontend-core/react';
import type { PermissionDefinition } from '@oppenheimer/shared/permissions';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavItem } from '../lib/nav';
import { useAuthorizedNav } from './use-authorized-nav';

/**
 * Two ungated rows and one gated row. Without the gated row every branch
 * returns the whole list and none of them is tested.
 */
const NAV: readonly NavItem[] = [
  { to: '/sessions', icon: Terminal, labelKey: 'sessions', policies: [] },
  { to: '/sessions/new', icon: Plus, labelKey: 'newSession' },
  {
    to: '/settings',
    icon: Settings,
    labelKey: 'settings',
    policies: [{ action: 'read', subject: 'Member' }],
  },
];

const UNGATED = ['/sessions', '/sessions/new'];
const EVERY = [...UNGATED, '/settings'];

/**
 * The sidebar's promise: a row is offered when the reader's ability satisfies
 * its policies. The failure branches matter as much as the happy one: while
 * permissions load a gated row must not flash in, and a permissions request
 * that failed must not empty the product — the guards are the real gate.
 */

vi.mock('@oppenheimer/frontend-core/react', () => ({ useMyPermissions: vi.fn() }));

function permissionsRead(data: PermissionDefinition[] | undefined, isError = false) {
  vi.mocked(useMyPermissions).mockReturnValue({
    data,
    isError,
  } as unknown as ReturnType<typeof useMyPermissions>);
}

const routesOffered = () => renderHook(() => useAuthorizedNav(NAV)).result.current.map((e) => e.to);

beforeEach(() => {
  vi.mocked(useMyPermissions).mockReset();
});

describe('useAuthorizedNav', () => {
  it.each([
    ['an owner', [{ action: 'manage', subject: 'all' }], EVERY],
    ['a reader holding the gated rule', [{ action: 'read', subject: 'Member' }], EVERY],
    ['a reader holding nothing', [], UNGATED],
    ['a reader holding an unrelated rule', [{ action: 'read', subject: 'Session' }], UNGATED],
  ] as [string, PermissionDefinition[], string[]][])(
    'offers %s the rows their rules reach',
    (_, permissions, expected) => {
      permissionsRead(permissions);

      expect(routesOffered()).toEqual(expected);
    },
  );

  it('offers only the ungated rows while the permission set is loading', () => {
    permissionsRead(undefined);

    expect(routesOffered()).toEqual(UNGATED);
  });

  it('offers every row when permissions could not be fetched', () => {
    permissionsRead(undefined, true);

    expect(routesOffered()).toEqual(EVERY);
  });
});

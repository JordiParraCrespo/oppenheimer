import { DropdownMenuItem, DropdownMenuSeparator } from '@oppenheimer/design-system-web';
import { KeyRound, Plus, Trash2, UserCog, Users } from '@oppenheimer/design-system-web/icons';
import type { AdminUserEntity } from '@oppenheimer/frontend-admin';
import { useAdminUsers } from '@oppenheimer/frontend-admin/react';
import { DataTable, useTableQuery } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AssignRolesDialog } from '@/features/admin-users/dialogs/assign-roles';
import { BanUserDialog } from '@/features/admin-users/dialogs/ban-user';
import { CreateUserDialog } from '@/features/admin-users/dialogs/create-user';
import { DeleteUserDialog } from '@/features/admin-users/dialogs/delete-user';
import { RevokeSessionsDialog } from '@/features/admin-users/dialogs/revoke-sessions';
import { SetPasswordDialog } from '@/features/admin-users/dialogs/set-password';
import { UnbanUserDialog } from '@/features/admin-users/dialogs/unban-user';
import { useUserColumns } from '@/features/admin-users/hooks/use-user-columns';

const PAGE_SIZE = 10;
type SortKey = 'name' | 'email' | 'createdAt';
type DialogState =
  | { kind: 'roles'; user: AdminUserEntity }
  | { kind: 'password'; user: AdminUserEntity }
  | { kind: 'ban'; user: AdminUserEntity }
  | { kind: 'unban'; user: AdminUserEntity }
  | { kind: 'sessions'; user: AdminUserEntity }
  | { kind: 'delete'; user: AdminUserEntity }
  | null;

/**
 * Every account on the platform, with the six things an administrator can do to
 * one.
 *
 * The dialogs open from here rather than from the row, because `rowActions`
 * renders inside the overflow popup and a dialog owned by the row would unmount
 * with the menu. Their state costs the table nothing: the props it takes do not
 * change when `dialog` does.
 */
export function UsersTable() {
  const { t } = useTranslation();
  const query = useTableQuery<SortKey>({
    sort: { key: 'createdAt', order: 'desc', keys: ['name', 'email', 'createdAt'] },
  });
  const searchField = query.search.includes('@') ? 'email' : 'name';
  const users = useAdminUsers({
    search: query.search || undefined,
    searchField,
    limit: PAGE_SIZE,
    offset: (query.page - 1) * PAGE_SIZE,
    sortBy: query.sort.key,
    sortDirection: query.sort.order,
  });
  const rows = users.data?.data ?? [];
  const columns = useUserColumns();

  const [createOpen, setCreateOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const closeDialog = () => setDialog(null);

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        getKey={(user) => user.id}
        selectable={false}
        isLoading={users.isLoading}
        isFetching={users.isFetching}
        emptyLabel={t(query.isFiltered ? 'control.users.noMatches' : 'control.users.empty')}
        emptyIcon={<Users />}
        search={{
          value: query.search,
          onChange: query.setSearch,
          placeholder: t('control.users.search'),
        }}
        addAction={{
          label: t('control.users.add'),
          icon: <Plus />,
          onClick: () => setCreateOpen(true),
        }}
        sort={{ ...query.sort, onChange: query.setSort }}
        pagination={{
          page: query.page,
          pageSize: PAGE_SIZE,
          total: users.data?.total ?? 0,
          totalPages: Math.max(1, Math.ceil((users.data?.total ?? 0) / PAGE_SIZE)),
          onPageChange: query.setPage,
        }}
        rowActions={(user) => (
          <>
            <DropdownMenuItem onClick={() => setDialog({ kind: 'roles', user })}>
              <UserCog />
              {t('control.users.actions.roles')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDialog({ kind: 'password', user })}>
              <KeyRound />
              {t('control.users.actions.password')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDialog({ kind: 'sessions', user })}>
              {t('control.users.actions.sessions')}
            </DropdownMenuItem>
            {!user.isSuperAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDialog({ kind: user.banned ? 'unban' : 'ban', user })}
                >
                  {t(user.banned ? 'control.users.actions.unban' : 'control.users.actions.ban')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDialog({ kind: 'delete', user })}
                >
                  <Trash2 />
                  {t('control.users.actions.delete')}
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      />
      {createOpen && <CreateUserDialog onClose={() => setCreateOpen(false)} />}
      {dialog?.kind === 'roles' && <AssignRolesDialog user={dialog.user} onClose={closeDialog} />}
      {dialog?.kind === 'password' && (
        <SetPasswordDialog user={dialog.user} onClose={closeDialog} />
      )}
      {dialog?.kind === 'ban' && <BanUserDialog user={dialog.user} onClose={closeDialog} />}
      {dialog?.kind === 'unban' && <UnbanUserDialog user={dialog.user} onClose={closeDialog} />}
      {dialog?.kind === 'sessions' && (
        <RevokeSessionsDialog user={dialog.user} onClose={closeDialog} />
      )}
      {dialog?.kind === 'delete' && <DeleteUserDialog user={dialog.user} onClose={closeDialog} />}
    </>
  );
}

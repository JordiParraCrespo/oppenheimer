import {
  Avatar,
  AvatarFallback,
  Badge,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@oppenheimer/design-system-web';
import { KeyRound, Plus, Trash2, UserCog, Users } from '@oppenheimer/design-system-web/icons';
import type { AdminUserEntity } from '@oppenheimer/frontend-admin';
import { useAdminUsers, useRoles, useUsersRoles } from '@oppenheimer/frontend-admin/react';
import {
  DataTable,
  type DataTableColumn,
  formatMediumDate,
  PageHead,
  RolePill,
  useTableQuery,
} from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AssignRolesDialog } from '@/features/admin-users/dialogs/assign-roles';
import { BanUserDialog } from '@/features/admin-users/dialogs/ban-user';
import { CreateUserDialog } from '@/features/admin-users/dialogs/create-user';
import { DeleteUserDialog } from '@/features/admin-users/dialogs/delete-user';
import { RevokeSessionsDialog } from '@/features/admin-users/dialogs/revoke-sessions';
import { SetPasswordDialog } from '@/features/admin-users/dialogs/set-password';
import { UnbanUserDialog } from '@/features/admin-users/dialogs/unban-user';

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

export function UsersScreen() {
  const { t, i18n } = useTranslation();
  const query = useTableQuery<SortKey>({
    sort: { key: 'createdAt', order: 'desc', keys: ['name', 'email', 'createdAt'] },
  });
  const searchField = query.searchQuery.includes('@') ? 'email' : 'name';
  const users = useAdminUsers({
    search: query.searchQuery || undefined,
    searchField,
    limit: PAGE_SIZE,
    offset: (query.page - 1) * PAGE_SIZE,
    sortBy: query.sort.key,
    sortDirection: query.sort.order,
  });
  const rows = users.data?.data ?? [];
  const userRolesQueries = useUsersRoles(rows.map((user) => user.id));
  const assignedRoles = new Map(
    rows.map((user, index) => [user.id, userRolesQueries[index]?.data ?? []]),
  );
  const roles = useRoles({ page: 1, limit: 100 });
  const [createOpen, setCreateOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const closeDialog = () => setDialog(null);

  const columns: DataTableColumn<AdminUserEntity>[] = [
    {
      key: 'name',
      label: t('control.users.columns.name'),
      sortKey: 'name',
      width: 250,
      render: (user) => (
        <span className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback gradient="purple">{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink-900">{user.name}</span>
            <span className="block truncate text-xs text-ink-400">{user.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'roles',
      label: t('control.users.columns.roles'),
      width: 220,
      render: (user) => {
        const current = assignedRoles.get(user.id) ?? [];
        return current.length ? (
          <span className="flex flex-wrap gap-1">
            {current.map((role) => (
              <RolePill key={role.id} role={role.name} />
            ))}
          </span>
        ) : (
          <span className="text-ink-400">{t('control.users.noRoles')}</span>
        );
      },
    },
    {
      key: 'access',
      label: t('control.users.columns.access'),
      width: 150,
      render: (user) => (
        <Badge variant={user.isSuperAdmin ? 'default' : 'neutral'}>
          {user.isSuperAdmin ? t('control.users.superAdmin') : t('control.users.consumer')}
        </Badge>
      ),
    },
    {
      key: 'status',
      label: t('control.users.columns.status'),
      width: 120,
      render: (user) => (
        <Badge variant={user.banned ? 'destructive' : 'active'}>
          {t(user.banned ? 'control.users.banned' : 'control.users.active')}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      label: t('control.users.columns.joined'),
      sortKey: 'createdAt',
      width: 150,
      render: (user) => (
        <span className="text-ink-600">{formatMediumDate(user.createdAt, i18n.language)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHead title={t('control.users.title')} sub={t('control.users.description')} />
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
      {dialog?.kind === 'roles' && (
        <AssignRolesDialog
          user={dialog.user}
          roles={roles.data?.data ?? []}
          assignedRoles={assignedRoles.get(dialog.user.id) ?? []}
          onClose={closeDialog}
        />
      )}
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

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

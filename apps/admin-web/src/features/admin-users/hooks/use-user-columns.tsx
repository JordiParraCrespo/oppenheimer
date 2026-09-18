import { Badge } from '@oppenheimer/design-system-web';
import type { AdminUserEntity } from '@oppenheimer/frontend-admin';
import { type DataTableColumn, formatMediumDate, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { UserCell } from '@/features/admin-users/components/user-cell';
import { UserRolesCell } from '@/features/admin-users/sections/user-roles-cell';

/**
 * The users table's columns: who, what they may do, and since when.
 *
 * It takes nothing about the rows. It used to take the page's roles as a `Map`,
 * which arrived new on every render and made these columns new with it — so a
 * single row's roles landing redrew every cell in the table. The roles column
 * names the cell and the cell waits on its own query.
 */
export function useUserColumns(): DataTableColumn<AdminUserEntity>[] {
  const { t } = useTranslation();
  const locale = useLocale();

  return [
    {
      key: 'name',
      label: t('control.users.columns.name'),
      sortKey: 'name',
      width: 250,
      render: (user) => <UserCell user={user} />,
    },
    {
      key: 'roles',
      label: t('control.users.columns.roles'),
      width: 220,
      render: (user) => <UserRolesCell userId={user.id} />,
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
        <span className="text-ink-600">{formatMediumDate(user.createdAt, locale)}</span>
      ),
    },
  ];
}

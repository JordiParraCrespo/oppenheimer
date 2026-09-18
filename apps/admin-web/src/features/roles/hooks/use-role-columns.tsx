import type { RoleEntity } from '@oppenheimer/frontend-admin';
import type { DataTableColumn } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { RoleCell } from '@/features/roles/components/role-cell';
import { RoleTypeBadge } from '@/features/roles/components/role-type-badge';

/**
 * The roles table's columns.
 *
 * A hook rather than a constant because every label is a `t()` call, and a hook
 * rather than a block inside the section because the section is a composition:
 * what a column looks like is a separate question from which page is on screen.
 */
export function useRoleColumns(): DataTableColumn<RoleEntity>[] {
  const { t } = useTranslation();

  return [
    {
      key: 'role',
      label: t('pages.team.roles.columns.role'),
      width: 380,
      render: (role) => <RoleCell role={role} />,
    },
    {
      key: 'type',
      label: t('pages.team.roles.columns.type'),
      width: 120,
      render: (role) => <RoleTypeBadge isSystem={role.isSystem} />,
    },
  ];
}

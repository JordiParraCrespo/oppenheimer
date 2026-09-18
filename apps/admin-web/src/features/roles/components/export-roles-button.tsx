import { Button } from '@oppenheimer/design-system-web';
import { Download } from '@oppenheimer/design-system-web/icons';
import type { RoleEntity } from '@oppenheimer/frontend-admin';
import { TABLE_HEADER_CONTROL_SIZE } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { exportRoles } from '@/features/roles/lib/export-roles';

/**
 * The roles table's one bulk action: download what is ticked.
 *
 * Its own component because the labels the CSV needs are five `t()` calls, and
 * a table is not improved by carrying them in the middle of its props.
 */
export function ExportRolesButton({ roles }: { roles: RoleEntity[] }) {
  const { t } = useTranslation();

  return (
    <Button
      variant="secondary"
      size={TABLE_HEADER_CONTROL_SIZE}
      onClick={() =>
        exportRoles(roles, {
          role: t('pages.team.roles.columns.role'),
          description: t('pages.team.roles.columns.description'),
          type: t('pages.team.roles.columns.type'),
          system: t('pages.team.roles.system'),
          custom: t('pages.team.roles.custom'),
        })
      }
    >
      <Download />
      {t('pages.team.roles.export')}
    </Button>
  );
}

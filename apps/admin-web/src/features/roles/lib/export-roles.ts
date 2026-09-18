import type { RoleEntity } from '@oppenheimer/frontend-admin';
import { downloadCsvRows } from '@oppenheimer/frontend-web';

export interface RoleExportLabels {
  role: string;
  description: string;
  type: string;
  system: string;
  custom: string;
}

/**
 * Export the picked roles.
 *
 * The type column is translated to match the members export — a reader who
 * exports both should not get one file in their language and one in English.
 * The labels arrive as an argument because this is `lib/`: it has no `t` of its
 * own, and it is the better for it.
 *
 * There is no member count. The column existed, took a `Map` nothing ever
 * passed, and wrote a zero per row.
 */
export function exportRoles(roles: RoleEntity[], labels: RoleExportLabels): void {
  downloadCsvRows(
    'roles.csv',
    [labels.role, labels.description, labels.type],
    roles.map((role) => [
      role.name,
      role.description ?? '',
      role.isSystem ? labels.system : labels.custom,
    ]),
  );
}

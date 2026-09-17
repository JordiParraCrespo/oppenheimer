import { ToggleGroup, ToggleGroupItem } from '@oppenheimer/design-system-web';
import type { AuthorizationCatalog } from '@oppenheimer/frontend-admin';
import type { RoleEditorDto } from '@oppenheimer/shared/schemas/role';
import { useTranslation } from 'react-i18next';
import {
  type PERMISSION_AREAS,
  type PermissionLevel,
  permissionLevel,
} from '@/features/roles/lib/permission-areas';

export function PermissionAreaRow({
  area,
  permissions,
  catalog,
  onChange,
}: {
  area: (typeof PERMISSION_AREAS)[number];
  permissions: RoleEditorDto['permissions'];
  catalog: AuthorizationCatalog | undefined;
  onChange: (permissions: RoleEditorDto['permissions']) => void;
}) {
  const { t } = useTranslation();
  const Icon = area.icon;
  const level = permissionLevel(permissions, area.subjects);
  const grantable = new Set(
    catalog?.grantable.map((rule) => `${rule.subject}:${rule.action}`) ?? [],
  );
  const resources =
    catalog?.groups
      .flatMap((group) => group.resources)
      .filter((resource) => area.subjects.includes(resource.subject)) ?? [];

  function setLevel(next: PermissionLevel) {
    const preserved = permissions.filter(
      (permission) => !area.subjects.includes(permission.subject),
    );
    if (next === 'none') return onChange(preserved);
    const additions = resources.flatMap((resource) =>
      resource.actions
        .filter(
          (action) =>
            grantable.has(`${resource.subject}:${action.name}`) &&
            (next === 'edit' || action.name === 'read'),
        )
        .map((action) => ({ action: action.name, subject: resource.subject })),
    );
    onChange([...preserved, ...additions]);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-3">
      <span className="flex size-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken text-ink-600">
        <Icon className="size-4" />
      </span>
      <span className="min-w-40 flex-1">
        <span className="block font-medium text-ink-900">
          {t(`pages.team.permissionAreas.${area.key}.name`)}
        </span>
        <span className="block text-xs text-ink-400">
          {t(`pages.team.permissionAreas.${area.key}.hint`)}
        </span>
      </span>
      <ToggleGroup
        multiple={false}
        value={[level]}
        onValueChange={(value) => value[0] && setLevel(value[0] as PermissionLevel)}
        variant="outline"
        size="sm"
      >
        {(['none', 'view', 'edit'] as const).map((value) => (
          <ToggleGroupItem key={value} value={value}>
            {t(`pages.team.roleForm.${value}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

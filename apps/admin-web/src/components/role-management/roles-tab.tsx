import {
  Badge,
  Button,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@oppenheimer/design-system-web';
import { Download, Plus, Shield, Trash2 } from '@oppenheimer/design-system-web/icons';
import type { RoleEntity } from '@oppenheimer/frontend';
import { useRoles } from '@oppenheimer/frontend/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  type DataTableColumn,
  TABLE_HEADER_CONTROL_SIZE,
} from '@/components/data-table';
import { downloadCsvRows } from '@/lib/download-csv';
import { useTableQuery } from '@/lib/use-table-query';
import { DeleteRoleDialog } from './confirm-dialog';
import { RoleEditorDialog } from './role-editor-dialog';

/** The design's roles table shows eight rows before it pages. */
const PAGE_SIZE = 8;

export function RolesTab({ roleCounts }: { roleCounts?: Map<string, number> }) {
  const { t } = useTranslation();
  // Prefixed for the same reason as the members tab beside it.
  const query = useTableQuery({ prefix: 'roles' });
  const { search, searchQuery, page } = query;

  /**
   * A page at a time, from the server. `GET /roles` has always returned a
   * paginated envelope — the tab used to ask for the first hundred and slice
   * them in the browser; now it asks the API for the page the reader is on.
   *
   * Its own query rather than the list `team.tsx` holds: that one is unsearched
   * and wide, because the members tab uses it to label rows and fill its role
   * facet, and a search here would empty both.
   */
  const roles = useRoles({
    page,
    limit: PAGE_SIZE,
    search: searchQuery || undefined,
  });
  const rows = roles.data?.data ?? [];
  const meta = roles.data?.meta;

  const [editor, setEditor] = useState<{
    role?: RoleEntity;
    duplicate?: boolean;
  } | null>(null);
  const [deleteRole, setDeleteRole] = useState<RoleEntity | null>(null);

  const columns: DataTableColumn<RoleEntity>[] = [
    {
      key: 'role',
      label: t('pages.team.roles.columns.role'),
      width: 380,
      render: (role) => (
        <span className="flex items-center gap-3">
          <span className="flex size-8 flex-none items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken text-ink-600">
            <Shield className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block font-medium text-ink-900">{role.name}</span>
            <span className="block max-w-96 truncate text-xs text-ink-400">
              {role.description || '—'}
            </span>
          </span>
        </span>
      ),
    },
    ...(roleCounts
      ? [
          {
            key: 'members',
            label: t('pages.team.roles.columns.members'),
            width: 140,
            render: (role: RoleEntity) => (
              <span className="text-ink-600">
                {t('pages.team.roles.memberCount', {
                  count: roleCounts.get(role.id) ?? 0,
                })}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'type',
      label: t('pages.team.roles.columns.type'),
      width: 120,
      render: (role) => (
        <Badge variant="neutral">
          {t(role.isSystem ? 'pages.team.roles.system' : 'pages.team.roles.custom')}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        getKey={(role) => role.id}
        isLoading={roles.isLoading}
        isFetching={roles.isFetching}
        emptyLabel={t('pages.team.roles.empty')}
        emptyIcon={<Shield />}
        search={{
          value: search,
          onChange: query.setSearch,
          placeholder: t('pages.team.roles.search'),
        }}
        addAction={{
          label: t('pages.team.roles.new'),
          icon: <Plus />,
          onClick: () => setEditor({}),
        }}
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: meta?.total ?? 0,
          totalPages: meta?.totalPages ?? 1,
          onPageChange: query.setPage,
        }}
        // Selecting roles exports them — a safe, non-destructive bulk action. A
        // role is still edited, duplicated or deleted one at a time through the
        // row menu.
        bulkActions={(selected) => (
          <Button
            variant="secondary"
            size={TABLE_HEADER_CONTROL_SIZE}
            onClick={() =>
              exportRoles(
                rows.filter((role) => selected.includes(role.id)),
                roleCounts ?? new Map(),
                {
                  role: t('pages.team.roles.columns.role'),
                  description: t('pages.team.roles.columns.description'),
                  members: t('pages.team.roles.columns.members'),
                  type: t('pages.team.roles.columns.type'),
                  system: t('pages.team.roles.system'),
                  custom: t('pages.team.roles.custom'),
                },
              )
            }
          >
            <Download />
            {t('pages.team.roles.export')}
          </Button>
        )}
        rowActions={(role) => (
          <>
            <DropdownMenuItem onClick={() => setEditor({ role })}>
              {t('pages.team.roles.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditor({ role, duplicate: true })}>
              {t('pages.team.roles.duplicate')}
            </DropdownMenuItem>
            {/* A system role is what the seed installs and the app depends on;
                it can be copied but not taken away. */}
            {!role.isSystem && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteRole(role)}>
                  <Trash2 />
                  {t('pages.team.roles.delete')}
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      />

      {editor && (
        <RoleEditorDialog
          key={`${editor.role?.id ?? 'new'}-${editor.duplicate ? 'copy' : 'edit'}`}
          role={editor.duplicate ? undefined : editor.role}
          sourceRole={editor.role}
          onClose={() => setEditor(null)}
        />
      )}
      {deleteRole && <DeleteRoleDialog role={deleteRole} onClose={() => setDeleteRole(null)} />}
    </>
  );
}

/**
 * Export the picked roles. The type column is translated to match the members
 * export — a reader who exports both should not get one file in their language
 * and one in English.
 */
function exportRoles(
  roles: RoleEntity[],
  roleCounts: Map<string, number>,
  labels: {
    role: string;
    description: string;
    members: string;
    type: string;
    system: string;
    custom: string;
  },
): void {
  downloadCsvRows(
    'roles.csv',
    [labels.role, labels.description, labels.members, labels.type],
    roles.map((role) => [
      role.name,
      role.description ?? '',
      String(roleCounts.get(role.id) ?? 0),
      role.isSystem ? labels.system : labels.custom,
    ]),
  );
}

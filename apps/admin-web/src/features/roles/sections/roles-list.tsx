import { DropdownMenuItem, DropdownMenuSeparator } from '@oppenheimer/design-system-web';
import { Plus, Shield, Trash2 } from '@oppenheimer/design-system-web/icons';
import type { RoleEntity } from '@oppenheimer/frontend-admin';
import { useRoles } from '@oppenheimer/frontend-admin/react';
import { DataTable, useTableQuery } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExportRolesButton } from '@/features/roles/components/export-roles-button';
import { DeleteRoleDialog } from '@/features/roles/dialogs/delete-role';
import { RoleEditorDialog } from '@/features/roles/dialogs/role-editor';
import { useRoleColumns } from '@/features/roles/hooks/use-role-columns';

/** The design's roles table shows eight rows before it pages. */
const PAGE_SIZE = 8;

/**
 * The roles table.
 *
 * The two dialogs are opened from here rather than from the row that triggers
 * them, and that is deliberate: `rowActions` renders inside the overflow
 * popup, so a dialog owned by the row would unmount the moment the menu closed.
 * It costs nothing — the table's props do not change when `editor` does.
 *
 * What did cost something was the search box: while the live value was a prop
 * of `DataTable`, every character re-rendered all eight rows. The field keeps
 * it now, and `setSearch` is called once per burst.
 *
 * It took a `roleCounts` map once, for a member-count column and a CSV column.
 * Nothing ever passed it: the only caller is the roles screen, so the column
 * never rendered and the export wrote a column of zeros. There is no endpoint
 * behind it either — `RoleEntity` carries no count — so it went, rather than
 * shipping a placeholder number.
 */
export function RolesList() {
  const { t } = useTranslation();
  // Prefixed for the same reason as the members tab beside it.
  const query = useTableQuery({ prefix: 'roles' });
  const { search, page } = query;

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
    search: search || undefined,
  });
  const rows = roles.data?.data ?? [];
  const meta = roles.data?.meta;

  const [editor, setEditor] = useState<{
    role?: RoleEntity;
    duplicate?: boolean;
  } | null>(null);
  const [deleteRole, setDeleteRole] = useState<RoleEntity | null>(null);

  const columns = useRoleColumns();

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
          <ExportRolesButton roles={rows.filter((role) => selected.includes(role.id))} />
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

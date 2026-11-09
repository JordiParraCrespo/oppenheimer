import {
  Field,
  FieldDescription,
  FieldLabel,
  RepositoryAddField,
  type RepositoryRowValue,
  Skeleton,
} from '@oppenheimer/design-system-web';
import {
  useRefreshInstallations,
  useStartInstallation,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, LoadingStatus, useManageRepositoryAccess } from '@oppenheimer/frontend-web';
import { type Control, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useProjectRepositoryOptions } from '../hooks/use-project-repository-options';
import type { ProjectFormValues } from '../lib/project-draft';

/**
 * Repositories, in the project dialog: a field that adds one at a time from
 * the App's list, the added ones listed under it with an X. It binds the
 * form's rows and reads the list it draws; nothing above it subscribes to
 * either. Its pane ends in "Manage repository access", as the session chip's
 * does: an organization's repositories appear once the App is installed there,
 * which is decided on GitHub, not here.
 */
export function ProjectRepositoriesField({ control }: { control: Control<ProjectFormValues> }) {
  const { t } = useTranslation();
  const { field } = useController({ control, name: 'rows' });
  const rows = field.value;
  const { options, loading } = useProjectRepositoryOptions(rows);
  const manageAccess = useManageRepositoryAccess(useStartInstallation(), useRefreshInstallations());

  /**
   * The add field's ids, reconciled with the rows: a new one is cloned by
   * default, on the repository's own default branch — the base its pill shows
   * until someone picks another, and what is sent if nobody does.
   */
  function setAdded(ids: string[]) {
    field.onChange(
      ids.map(
        (id): RepositoryRowValue =>
          rows.find((row) => row.id === id) ?? {
            id,
            isDefault: true,
            branch: options.find((option) => option.id === id)?.defaultBranch ?? '',
          },
      ),
    );
  }

  return (
    <Field>
      <FieldLabel>{t('projects.dialog.repositories')}</FieldLabel>
      {loading ? (
        // The add field and a row's place for each repository the project
        // already has: the rows are known, only their names are still coming.
        <div aria-busy className="flex flex-col gap-2.5">
          <LoadingStatus />
          <Skeleton shape="sm" className="h-(--control-h-md) w-full" />
          {rows.length ? (
            <ul
              aria-hidden
              className="m-0 flex list-none flex-col rounded-md border border-border-subtle p-0"
            >
              {rows.map((row, index) => (
                <li
                  key={row.id}
                  className="flex min-h-10 items-center gap-2.5 border-t border-border-subtle pr-1.5 pl-3 first:border-t-0"
                >
                  <Skeleton shape="sm" className="size-[15px] shrink-0" />
                  <span className="flex h-5 min-w-0 flex-1 items-center">
                    <Skeleton
                      shape="sm"
                      className={`h-2.5 ${['w-36', 'w-28', 'w-44'][index % 3]}`}
                    />
                  </span>
                  <span className="size-(--control-h-sm) shrink-0" />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <RepositoryAddField
          repositories={options}
          value={rows.map((row) => row.id)}
          onValueChange={setAdded}
          placeholder={t('projects.dialog.addRepository')}
          emptyText={(query) =>
            query ? t('projects.dialog.noMatch', { query }) : t('projects.dialog.allAdded')
          }
          removeLabel={(name) => t('projects.dialog.remove', { name })}
          onManage={manageAccess.onManage}
          manageLabel={t('common.repositoryAccess.manage')}
        />
      )}
      <ErrorAlert
        error={manageAccess.error}
        fallback={t('common.repositoryAccess.failed')}
        onDismiss={manageAccess.dismiss}
      />
      {rows.length === 0 ? (
        <FieldDescription>{t('projects.dialog.repositoriesHint')}</FieldDescription>
      ) : null}
    </Field>
  );
}

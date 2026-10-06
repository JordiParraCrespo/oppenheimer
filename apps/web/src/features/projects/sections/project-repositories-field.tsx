import {
  BrandGlyph,
  Field,
  FieldDescription,
  FieldLabel,
  RepositoryAddField,
  type RepositoryRowValue,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { ArrowUpRight } from '@oppenheimer/design-system-web/icons';
import { useManageGithubAccess } from '@oppenheimer/frontend-consumer/react';
import { useDeploymentCapabilities } from '@oppenheimer/frontend-core/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
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
  const installUrl = useDeploymentCapabilities({
    select: (deployment) => deployment.github_app_install_url,
  });
  const manageAccess = useManageGithubAccess();

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
        <Skeleton className="h-(--control-h-md) w-full" />
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
          action={
            installUrl.data
              ? {
                  label: t('projects.dialog.manage'),
                  icon: <BrandGlyph name="github" size={15} />,
                  trailing: <ArrowUpRight />,
                  onSelect: manageAccess.manage,
                }
              : undefined
          }
        />
      )}
      <ErrorAlert
        error={manageAccess.error}
        fallback={t('projects.dialog.manageFailed')}
        onDismiss={manageAccess.dismiss}
      />
      {rows.length === 0 ? (
        <FieldDescription>{t('projects.dialog.repositoriesHint')}</FieldDescription>
      ) : null}
    </Field>
  );
}

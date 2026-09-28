import {
  Field,
  FieldDescription,
  FieldLabel,
  RepositoryAddField,
  type RepositoryRowValue,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { type Control, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useProjectRepositoryOptions } from '../hooks/use-project-repository-options';
import type { ProjectFormValues } from '../lib/project-draft';

/**
 * Repositories, in the project dialog: a field that adds one at a time from
 * the App's list, the added ones listed under it with an X. It binds the
 * form's rows and reads the list it draws; nothing above it subscribes to
 * either.
 */
export function ProjectRepositoriesField({ control }: { control: Control<ProjectFormValues> }) {
  const { t } = useTranslation();
  const { field } = useController({ control, name: 'rows' });
  const rows = field.value;
  const { options, loading } = useProjectRepositoryOptions(rows);

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
        />
      )}
      {rows.length === 0 ? (
        <FieldDescription>{t('projects.dialog.repositoriesHint')}</FieldDescription>
      ) : null}
    </Field>
  );
}

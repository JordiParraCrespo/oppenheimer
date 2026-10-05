import { RepositoryRowList } from '@oppenheimer/design-system-web';
import { type Control, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useProjectRepositoryOptions } from '../hooks/use-project-repository-options';
import type { ProjectFormValues } from '../lib/project-draft';

/**
 * Cloned by default, in the project dialog's Defaults: a checkbox per added
 * repository with its base-branch pill. It binds the form's rows and reads the
 * branches it lists.
 */
export function ProjectClonedField({ control }: { control: Control<ProjectFormValues> }) {
  const { t } = useTranslation();
  const { field } = useController({ control, name: 'rows' });
  const rows = field.value;
  const { options } = useProjectRepositoryOptions(rows);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-fg-muted">{t('projects.dialog.clonedByDefault')}</span>
      {rows.length === 0 ? (
        <p className="m-0 text-xs text-fg-subtle">{t('projects.dialog.selectFirst')}</p>
      ) : (
        <RepositoryRowList
          repositories={options}
          value={rows}
          onValueChange={field.onChange}
          defaultTitle={t('projects.dialog.clonedTitle')}
          branchSearchPlaceholder={t('sessions.new.repository.branchSearch')}
          branchEmptyText={(query) => t('projects.dialog.branchEmpty', { query })}
          branchLabel={(name) => t('sessions.new.repository.branchPane', { name })}
        />
      )}
    </div>
  );
}

import { FieldSelect } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * The Project row of the task and milestone dialogs: the label in the left
 * column, as a `ChoiceRow`'s, and the project as a select with a search, so a
 * workspace with many projects is one field rather than a wall of pills.
 */
export function ProjectSelectRow({
  label,
  projects,
  value,
  onChange,
}: {
  label: string;
  projects: readonly { id: string; name: string }[];
  value: string | null;
  onChange: (projectId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-3">
      <span className="flex h-(--control-h-md) items-center text-sm text-fg-muted">{label}</span>
      <FieldSelect
        className="w-64 max-w-full"
        aria-label={label}
        placeholder={t('tasks.dialog.chooseProject')}
        searchPlaceholder={t('common.search.projects')}
        emptyText={(query) => t('common.search.noMatch', { query })}
        value={value}
        options={projects.map((project) => ({ value: project.id, label: project.name }))}
        onValueChange={onChange}
      />
    </div>
  );
}

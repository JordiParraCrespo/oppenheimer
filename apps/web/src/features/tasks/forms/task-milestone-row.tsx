import { type Control, useController, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ChoiceRow } from '../components/choice-row';
import type { TaskFormInput } from '../lib/task-form';

/**
 * The milestone row: the milestones of the project picked above it. It watches the project
 * itself, so a project pick redraws this row and not the form.
 */
export function TaskMilestoneRow({
  control,
  milestones,
}: {
  control: Control<TaskFormInput>;
  milestones: readonly { id: string; name: string; projectId: string }[];
}) {
  const { t } = useTranslation();
  const projectId = useWatch({ control, name: 'projectId' });
  const { field } = useController({ control, name: 'milestoneId' });
  const choices = [
    { value: null, label: t('tasks.dialog.none') },
    ...milestones
      .filter((milestone) => milestone.projectId === projectId)
      .map((milestone) => ({ value: milestone.id, label: milestone.name })),
  ];
  return (
    <ChoiceRow
      label={t('tasks.dialog.milestone')}
      choices={choices}
      value={field.value ?? null}
      onChange={field.onChange}
    />
  );
}

import { type Control, useController, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ChoiceRow } from '../components/choice-row';
import type { TaskFormInput } from '../lib/task-form';

/**
 * The goal row: the goals of the project picked above it. It watches the project
 * itself, so a project pick redraws this row and not the form.
 */
export function TaskGoalRow({
  control,
  goals,
}: {
  control: Control<TaskFormInput>;
  goals: readonly { id: string; name: string; projectId: string }[];
}) {
  const { t } = useTranslation();
  const projectId = useWatch({ control, name: 'projectId' });
  const { field } = useController({ control, name: 'goalId' });
  const choices = [
    { value: null, label: t('tasks.dialog.none') },
    ...goals
      .filter((goal) => goal.projectId === projectId)
      .map((goal) => ({ value: goal.id, label: goal.name })),
  ];
  return (
    <ChoiceRow
      label={t('tasks.dialog.goal')}
      choices={choices}
      value={field.value ?? null}
      onChange={field.onChange}
    />
  );
}

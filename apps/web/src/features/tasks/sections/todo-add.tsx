import { TodoRowAdd } from '@oppenheimer/design-system-web';
import { useCreateTask } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScopeProject } from '../hooks/use-scope-project';
import { useTodoDay } from '../hooks/use-todo-day';

/**
 * The dashed row under To do's list: Enter adds the typed task, due on the
 * day shown, in the project the view is narrowed to when it is one (the
 * Unassigned project otherwise). The field keeps what is typed until it is
 * added.
 */
export function TodoAdd() {
  const { t } = useTranslation();
  const { day } = useTodoDay();
  const { projectIds } = useScopeProject();
  const create = useCreateTask();
  const [draft, setDraft] = useState('');

  return (
    <>
      <ErrorAlert error={create.error} fallback={t('tasks.todo.addFailed')} />
      <TodoRowAdd
        aria-label={t('tasks.todo.addLabel')}
        placeholder={t('tasks.todo.add')}
        value={draft}
        disabled={create.isPending}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          const title = draft.trim();
          if (event.key !== 'Enter' || !title) return;
          create.mutate(
            {
              title,
              dueDate: day,
              projectId: projectIds?.length === 1 ? projectIds[0] : undefined,
            },
            { onSuccess: () => setDraft('') },
          );
        }}
      />
    </>
  );
}

import { Chip } from '@oppenheimer/design-system-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

const todo = getRouteApi('/_authenticated/plan/todo');

/** Include overdue, at the end of To do's filter row: on unless the address says `overdue=off`. */
export function TodoOverdueToggle() {
  const { t } = useTranslation();
  const { overdue } = todo.useSearch();
  const navigate = todo.useNavigate();
  const on = overdue !== 'off';
  return (
    <Chip
      selected={on}
      aria-pressed={on}
      onClick={() =>
        navigate({
          search: (previous) => ({ ...previous, overdue: on ? 'off' : undefined }),
          replace: true,
        })
      }
    >
      {t('tasks.todo.includeOverdue')}
    </Chip>
  );
}

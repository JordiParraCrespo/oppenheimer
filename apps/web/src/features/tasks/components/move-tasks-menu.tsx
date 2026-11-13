import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  dotVariants,
  IconButton,
  TASK_STATUS_STATE,
} from '@oppenheimer/design-system-web';
import { ArrowRightLeft } from '@oppenheimer/design-system-web/icons';
import { TASK_STATUSES, type TaskStatus } from '@oppenheimer/shared/schemas/task';
import { useTranslation } from 'react-i18next';

/** The selection bar's Move to: a column for every picked card at once. */
export function MoveTasksMenu({
  disabled,
  onPick,
}: {
  disabled?: boolean;
  onPick: (status: TaskStatus) => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <IconButton
            size="sm"
            variant="quiet"
            aria-label={t('tasks.selection.move')}
            title={t('tasks.selection.move')}
          />
        }
      >
        <ArrowRightLeft />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('tasks.selection.moveTo')}</DropdownMenuLabel>
          {TASK_STATUSES.map((status) => (
            <DropdownMenuItem key={status} onClick={() => onPick(status)}>
              <span aria-hidden className={dotVariants({ state: TASK_STATUS_STATE[status] })} />
              {t(`tasks.columns.${status}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

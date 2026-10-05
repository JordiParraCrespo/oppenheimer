import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
} from '@oppenheimer/design-system-web';
import { Ellipsis } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * A table row's ellipsis: Edit, Run now, Pause or Resume, Duplicate, Delete
 * (the frame's order). Props in, choice out: the mutations are the section's.
 * The trigger and the menu both stop the click: the menu is portaled, but a
 * React event still bubbles to the row, which would open the automation's
 * page under a pick (and unmount the table's delete confirm with it).
 */
export function AutomationRowMenu({
  open,
  onOpenChange,
  paused,
  onEdit,
  onRunNow,
  onTogglePause,
  onDuplicate,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paused: boolean;
  onEdit: () => void;
  onRunNow: () => void;
  onTogglePause: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <IconButton
            aria-label={t('automations.table.actions')}
            size="sm"
            variant="quiet"
            onClick={(event) => event.stopPropagation()}
          />
        }
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-45"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem onClick={onEdit}>{t('automations.table.edit')}</DropdownMenuItem>
        <DropdownMenuItem onClick={onRunNow}>{t('automations.table.runNow')}</DropdownMenuItem>
        <DropdownMenuItem onClick={onTogglePause}>
          {paused ? t('automations.table.resume') : t('automations.table.pause')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          {t('automations.table.duplicate')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          {t('automations.table.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

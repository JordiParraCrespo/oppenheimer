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
 * The trigger stops the click so opening the menu does not open the row.
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
      <DropdownMenuContent align="end" className="min-w-45">
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

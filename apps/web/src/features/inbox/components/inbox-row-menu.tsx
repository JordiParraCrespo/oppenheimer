import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  IconButton,
} from '@oppenheimer/design-system-web';
import {
  Check,
  Clock,
  Ellipsis,
  TrendingDown,
  TrendingUp,
  X,
} from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * A row's ellipsis menu (the 2026-10-26 frame): Mark as done, Deprioritize or
 * Restore priority, the two snoozes and Delete; a done row has Delete alone.
 * The keys are painted only on the item in the pane, the one E and L act on.
 */
export function InboxRowMenu({
  open,
  onOpenChange,
  done,
  low,
  keys,
  onDone,
  onToggleLow,
  onSnoozeHour,
  onSnoozeTomorrow,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  done: boolean;
  low: boolean;
  keys: boolean;
  onDone: () => void;
  onToggleLow: () => void;
  onSnoozeHour: () => void;
  onSnoozeTomorrow: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={<IconButton aria-label={t('inbox.menu.label')} size="xs" variant="quiet" />}
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-50">
        {done ? null : (
          <>
            <DropdownMenuItem onClick={onDone}>
              <Check />
              {t('inbox.menu.done')}
              {keys ? <DropdownMenuShortcut>E</DropdownMenuShortcut> : null}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleLow}>
              {low ? <TrendingUp /> : <TrendingDown />}
              {low ? t('inbox.menu.restore') : t('inbox.menu.low')}
              {keys ? <DropdownMenuShortcut>L</DropdownMenuShortcut> : null}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSnoozeHour}>
              <Clock />
              {t('inbox.menu.snoozeHour')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSnoozeTomorrow}>
              <Clock />
              {t('inbox.menu.snoozeTomorrow')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem variant="destructive" onClick={onRemove}>
          <X />
          {t('inbox.menu.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

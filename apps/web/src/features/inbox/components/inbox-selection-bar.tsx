import {
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  InboxSelectionHead,
} from '@oppenheimer/design-system-web';
import {
  Check,
  Clock,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import type { InboxMarkActionName } from '@/features/inbox/lib/inbox-mark-actions';

/**
 * The list column's head while rows are selected: select all (mixed while
 * some are), how many, and what the row menu does, to every one of them at
 * once: Mark as done, Deprioritize or Restore priority, the two snoozes and
 * Delete. The cross leaves selecting, as Escape does.
 */
export function InboxSelectionBar({
  count,
  all,
  low,
  onToggleAll,
  onAction,
  onClear,
}: {
  count: number;
  all: boolean;
  /** Every selected row is already low: the toggle restores them. */
  low: boolean;
  onToggleAll: () => void;
  /** One of the Inbox's actions, on every selected row. */
  onAction: (action: InboxMarkActionName) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const lowLabel = low ? t('inbox.selection.restore') : t('inbox.selection.low');

  return (
    <InboxSelectionHead
      aria-label={t('inbox.selection.label')}
      count={t('inbox.selection.count', { count })}
      leading={
        <Checkbox
          className="size-3.5"
          checked={all}
          indeterminate={!all}
          onCheckedChange={onToggleAll}
          aria-label={t('inbox.selection.selectAll')}
        />
      }
    >
      <IconButton
        size="xs"
        variant="quiet"
        aria-label={t('inbox.selection.done')}
        title={t('inbox.selection.done')}
        onClick={() => onAction('done')}
      >
        <Check />
      </IconButton>
      <IconButton
        size="xs"
        variant="quiet"
        aria-label={lowLabel}
        title={lowLabel}
        onClick={() => onAction('toggleLow')}
      >
        {low ? <TrendingUp /> : <TrendingDown />}
      </IconButton>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <IconButton
              size="xs"
              variant="quiet"
              aria-label={t('inbox.selection.snooze')}
              title={t('inbox.selection.snooze')}
            />
          }
        >
          <Clock />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-50">
          <DropdownMenuItem onClick={() => onAction('snoozeHour')}>
            <Clock />
            {t('inbox.menu.snoozeHour')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction('snoozeTomorrow')}>
            <Clock />
            {t('inbox.menu.snoozeTomorrow')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <IconButton
        size="xs"
        variant="quiet"
        aria-label={t('inbox.selection.delete')}
        title={t('inbox.selection.delete')}
        onClick={() => onAction('remove')}
      >
        <Trash2 />
      </IconButton>
      <IconButton
        size="xs"
        variant="quiet"
        aria-label={t('inbox.selection.clear')}
        title={t('inbox.selection.clear')}
        onClick={onClear}
      >
        <X />
      </IconButton>
    </InboxSelectionHead>
  );
}
